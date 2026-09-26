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

export interface MtgjsonSetFile {
  data: {
    code: string;
    name: string;
    releaseDate?: string;
    baseSetSize?: number;
    booster?: Record<string, MtgjsonBoosterConfig>;
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

const WORDS: Record<string, string> = {
  dfc: "double-faced",
  mdfc: "modal double-faced",
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
    .toLowerCase()
    .split(/\s+/)
    .map((w) => WORDS[w] ?? w);
  const text = words.join(" ").replace(/\brare mythic\b/g, "rare/mythic");
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
