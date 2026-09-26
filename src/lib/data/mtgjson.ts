import type { BoosterModel, BoosterType, Sheet, SheetEntry } from "../types";

// MTGJSON v5 booster shapes. See https://mtgjson.com/data-models/booster/
export interface MtgjsonBoosterConfig {
  boosters: { contents: Record<string, number>; weight: number }[];
  boostersTotalWeight?: number;
  name?: string;
  sheets: Record<
    string,
    {
      cards: Record<string, number>;
      foil: boolean;
      totalWeight?: number;
      allowDuplicates?: boolean;
      balanceColors?: boolean;
      fixed?: boolean;
    }
  >;
  sourceSetCodes?: string[];
}

export interface MtgjsonCard {
  uuid: string;
  name: string;
  number: string;
  setCode: string;
  side?: string;
  identifiers?: { scryfallId?: string };
}

/** A sealed product as MTGJSON records it: what's inside, and its id on TCGplayer. */
export interface MtgjsonSealedProduct {
  uuid: string;
  name: string;
  /** "booster_box", "booster_pack", "booster_case", "bundle", … */
  category?: string;
  subtype?: string;
  contents?: {
    /** Other sealed products inside, by MTGJSON uuid. */
    sealed?: { count?: number; name?: string; set?: string; uuid?: string }[];
    /** A booster, by the booster config it's opened from. */
    pack?: { code: string; set: string }[];
    /** A random choice between contents. */
    variable?: unknown[];
    [other: string]: unknown;
  };
  identifiers?: { tcgplayerProductId?: string };
}

/** A card in a deck list: which printing, how many, and in which finish. */
export interface MtgjsonDeckRef {
  count: number;
  uuid: string;
  isFoil?: boolean;
  isEtched?: boolean;
}

/** A preconstructed product's list as a set file carries it: a Commander deck or a Secret Lair drop. */
export interface MtgjsonDeck {
  code: string;
  name: string;
  type: string;
  releaseDate?: string;
  commander?: MtgjsonDeckRef[];
  mainBoard?: MtgjsonDeckRef[];
  sideBoard?: MtgjsonDeckRef[];
  sealedProductUuids?: string[] | null;
  sourceSetCodes?: string[];
}

export interface MtgjsonSetFile {
  data: {
    code: string;
    name: string;
    releaseDate?: string;
    baseSetSize?: number;
    booster?: Record<string, MtgjsonBoosterConfig>;
    sealedProduct?: MtgjsonSealedProduct[];
    decks?: MtgjsonDeck[];
    tcgplayerGroupId?: number;
    cards: MtgjsonCard[];
    tokens?: MtgjsonCard[];
  };
}

/** MTGJSON's booster keys for each booster we price. Older set files call the draft booster "default". */
export const MTGJSON_BOOSTER_KEYS: Record<BoosterType, string[]> = {
  play: ["play"],
  draft: ["draft", "default"],
  set: ["set"],
  collector: ["collector"],
};

export function boosterConfig(set: MtgjsonSetFile["data"], type: BoosterType): { name: string; config: MtgjsonBoosterConfig } | null {
  const boosters = set.booster ?? {};
  for (const name of MTGJSON_BOOSTER_KEYS[type]) {
    if (boosters[name]) return { name, config: boosters[name] };
  }
  return null;
}

const TYPE_OF_KEY: Record<string, BoosterType> = { play: "play", draft: "draft", default: "draft", set: "set", collector: "collector" };

/** What MTGJSON's sealed records say about a set's boosters. */
export interface SealedBoosters {
  /** Packs in a display of each booster, from the display's recorded contents. */
  displays: Partial<Record<BoosterType, number>>;
  /** TCGplayer product id of each booster's display. */
  boxIds: Partial<Record<BoosterType, number>>;
  /** Boosters inside every product with a TCGplayer id, where they're all one kind. */
  byTcgplayerId: Map<number, { booster: BoosterType; packs: number }>;
}

/**
 * Count the boosters in each of the set's sealed products by following their contents
 * down to booster packs: a bundle of nine Play Boosters counts nine, a case of six
 * displays counts six displays' worth. Box toppers, sample packs, lands and dice don't
 * count. A product that mixes boosters of different kinds, holds another set's boosters
 * or has random contents gets no count.
 */
export function sealedBoosters(set: MtgjsonSetFile["data"]): SealedBoosters {
  const products = set.sealedProduct ?? [];
  const byUuid = new Map(products.map((p) => [p.uuid, p]));
  const code = set.code.toLowerCase();
  const memo = new Map<string, { booster: BoosterType; packs: number } | null>();

  const count = (p: MtgjsonSealedProduct, depth = 0): { booster: BoosterType; packs: number } | null => {
    if (memo.has(p.uuid)) return memo.get(p.uuid)!;
    let booster: BoosterType | null = null;
    let packs = 0;
    let ok = depth < 6 && !p.contents?.variable?.length;
    const add = (type: BoosterType, n: number) => {
      if (booster && booster !== type) ok = false;
      booster = type;
      packs += n;
    };
    for (const pack of p.contents?.pack ?? []) {
      const type = TYPE_OF_KEY[pack.code];
      if (!type) continue; // box toppers, samples, promos
      if (pack.set?.toLowerCase() !== code) ok = false;
      else add(type, 1);
    }
    for (const item of p.contents?.sealed ?? []) {
      const inner = item.uuid ? byUuid.get(item.uuid) : undefined;
      if (!inner) {
        // Something from another set or not recorded; if it holds boosters we can't tell.
        if (item.set && item.set.toLowerCase() !== code) ok = false;
        continue;
      }
      const c = count(inner, depth + 1);
      if (c) add(c.booster, c.packs * (item.count ?? 1));
    }
    const out = ok && booster && packs > 0 ? { booster, packs } : null;
    memo.set(p.uuid, out);
    return out;
  };

  const displays: SealedBoosters["displays"] = {};
  const boxIds: SealedBoosters["boxIds"] = {};
  const byTcgplayerId = new Map<number, { booster: BoosterType; packs: number }>();
  // A booster's display is the box filed under that booster (not a premium or special box
  // that happens to hold the same packs), and the smallest of those: master cases are
  // sometimes filed as boxes too.
  const boxes = products
    .filter((p) => p.category === "booster_box")
    .map((p) => ({ p, c: count(p), id: Number(p.identifiers?.tcgplayerProductId) || null }))
    .filter((b) => b.c)
    .map((b) => ({ ...b, filed: TYPE_OF_KEY[b.p.subtype ?? ""] === b.c!.booster }))
    .sort((a, b) => Number(b.filed) - Number(a.filed) || a.c!.packs - b.c!.packs || Number(b.id != null) - Number(a.id != null));
  for (const { c, id } of boxes) {
    if (displays[c!.booster] == null) {
      displays[c!.booster] = c!.packs;
      if (id) boxIds[c!.booster] = id;
    }
  }
  for (const p of products) {
    const id = Number(p.identifiers?.tcgplayerProductId);
    const c = count(p);
    if (id && c) byTcgplayerId.set(id, c);
  }
  return { displays, boxIds, byTcgplayerId };
}

const WORDS: Record<string, string> = {
  dfc: "double-faced",
  mdfc: "modal double-faced",
  sfc: "single-faced",
  rm: "rare/mythic",
  cu: "common/uncommon",
  spg: "Special Guests",
  list: "The List",
  sld: "Secret Lair",
};

/** "borderlessRareMythic" → "Borderless rare/mythic". */
export function sheetLabel(key: string): string {
  if (key === "foil") return "Traditional foil";
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    // "masterpiece1In144" → "masterpiece 1 In 144"
    .replace(/([a-z])(\d)/gi, "$1 $2")
    .replace(/(\d)([a-z])/gi, "$1 $2")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => WORDS[w] ?? w);
  const text = words
    .join(" ")
    .replace(/\brare mythic\b/g, "rare/mythic")
    .replace(/\bcommon uncommon\b/g, "common/uncommon")
    .replace(/^the The List\b/, "The List");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export interface MtgjsonBuild {
  model: BoosterModel;
  /** Scryfall ids referenced by the model, in model card-index order. */
  scryfallIds: string[];
  missing: string[];
}

/**
 * Convert an MTGJSON booster config into our model. Card entries are indexed by the
 * position of their Scryfall id in `scryfallIds`, which the caller then resolves.
 */
export function buildModelFromMtgjson(
  config: MtgjsonBoosterConfig,
  uuidToScryfall: Map<string, string>,
): MtgjsonBuild {
  const ids: string[] = [];
  const indexOf = new Map<string, number>();
  const missing: string[] = [];
  const sheets: Record<string, Sheet> = {};

  for (const [key, sheet] of Object.entries(config.sheets)) {
    const entries: SheetEntry[] = [];
    for (const [uuid, weight] of Object.entries(sheet.cards)) {
      const sid = uuidToScryfall.get(uuid);
      if (!sid) {
        missing.push(uuid);
        continue;
      }
      let i = indexOf.get(sid);
      if (i === undefined) {
        i = ids.length;
        ids.push(sid);
        indexOf.set(sid, i);
      }
      entries.push([i, weight, sheet.foil ? 1 : 0]);
    }
    sheets[key] = { label: sheetLabel(key), entries };
  }

  return {
    model: {
      variants: config.boosters.map((b) => ({ weight: b.weight, contents: { ...b.contents } })),
      sheets,
    },
    scryfallIds: ids,
    missing,
  };
}

/** Rewrite model card indices after cards were looked up and some went missing. */
export function remapModel(model: BoosterModel, map: (oldIndex: number) => number | undefined): BoosterModel {
  const sheets: Record<string, Sheet> = {};
  for (const [key, sheet] of Object.entries(model.sheets)) {
    const entries: SheetEntry[] = [];
    for (const [i, w, f] of sheet.entries) {
      const j = map(i);
      if (j !== undefined) entries.push([j, w, f]);
    }
    sheets[key] = { label: sheet.label, entries };
  }
  return { variants: model.variants, sheets };
}
