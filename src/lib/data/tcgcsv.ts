import { BOOSTER_TYPES } from "../boosters";
import type { BoosterType, BoxPrice, SealedKind, SealedProduct } from "../types";
import type { FetchLike } from "./scryfall";

// TCGCSV mirrors TCGplayer's catalog and daily prices as JSON. Category 1 is Magic.
// https://tcgcsv.com
export const TCGCSV = "https://tcgcsv.com/tcgplayer";
const MAGIC = 1;

interface Envelope<T> {
  success?: boolean;
  results: T[];
}

export interface TcgGroup {
  groupId: number;
  name: string;
  abbreviation?: string | null;
  isSupplemental?: boolean;
  /** Release date, e.g. "2024-08-02T00:00:00". */
  publishedOn?: string | null;
}

export interface TcgProduct {
  productId: number;
  name: string;
  url?: string;
  imageUrl?: string;
  /** Singles carry Rarity and Number here; sealed products don't. */
  extendedData?: { name: string; value?: string }[];
}

export interface TcgPrice {
  productId: number;
  marketPrice?: number | null;
  midPrice?: number | null;
  lowPrice?: number | null;
  subTypeName?: string;
}

/** Pick the set's main TCGplayer group: exact code match first, then exact name. */
export function findGroup(groups: TcgGroup[], code: string, name: string): TcgGroup | null {
  const byCode = groups.filter((g) => g.abbreviation?.toLowerCase() === code.toLowerCase());
  const main = byCode.find((g) => !g.isSupplemental) ?? byCode[0];
  if (main) return main;
  const byName = groups.filter((g) => g.name.toLowerCase() === name.toLowerCase());
  return byName.find((g) => !g.isSupplemental) ?? byName[0] ?? null;
}

/**
 * TCGplayer files a set's Commander precons and Jumpstart boosters under companion
 * groups such as "Commander: Bloomburrow" or "Foundations Jumpstart". Match on the
 * set's leading name and a release date within two months, so "Commander: Duskmourn"
 * pairs with "Duskmourn: House of Horror".
 */
export function findCompanionGroups(groups: TcgGroup[], main: TcgGroup, setName: string, releasedAt: string): TcgGroup[] {
  const key = setName.split(":")[0].trim().toLowerCase();
  const released = Date.parse(releasedAt.slice(0, 10));
  const WINDOW = 60 * 86_400_000;
  return groups.filter((g) => {
    if (g.groupId === main.groupId || !/commander|jumpstart/i.test(g.name)) return false;
    if (!g.name.toLowerCase().includes(key)) return false;
    const published = g.publishedOn ? Date.parse(g.publishedOn.slice(0, 10)) : Number.NaN;
    return Number.isNaN(published) || Number.isNaN(released) || Math.abs(published - released) <= WINDOW;
  });
}

/**
 * The display (the 12-, 30- or 36-pack box) of one booster type, not a case, bundle or
 * single pack. Special editions and other variants lose to the plain listing.
 */
export function findBoxProduct(products: TcgProduct[], type: BoosterType, opts: ClassifyOptions = {}): TcgProduct | null {
  const candidates = products.filter((p) => classifySealed(p, opts) === BOOSTER_KINDS[type].display && !/special edition/i.test(p.name));
  const rank = (p: TcgProduct) => [Number(/[([]/.test(p.name)), Number(!/display/i.test(p.name)), p.name.length];
  candidates.sort((a, b) => {
    const [x, y] = [rank(a), rank(b)];
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  });
  return candidates[0] ?? null;
}

function isSingle(p: TcgProduct): boolean {
  return (p.extendedData ?? []).some((d) => d.name === "Number" || d.name === "Rarity");
}

// Other-language printings: priced against English singles they'd be misleading.
const FOREIGN = /\((japanese|jp|chinese|korean|german|french|italian|spanish|portuguese|russian)\)|\bjapanese\b/i;

const BOOSTER_KINDS: Record<BoosterType, { display: SealedKind; pack: SealedKind; case: SealedKind }> = {
  play: { display: "Play Booster Display", pack: "Play Booster Pack", case: "Play Booster Case" },
  draft: { display: "Draft Booster Display", pack: "Draft Booster Pack", case: "Draft Booster Case" },
  set: { display: "Set Booster Display", pack: "Set Booster Pack", case: "Set Booster Case" },
  collector: { display: "Collector Booster Display", pack: "Collector Booster Pack", case: "Collector Booster Case" },
};

export interface ClassifyOptions {
  /** A Commander companion group: any sealed deck in it is a precon. */
  commander?: boolean;
  /**
   * What an unqualified "Booster Box" or "Booster Pack" holds. Before Set Boosters
   * (2020) TCGplayer lists Draft Boosters that way.
   */
  plainBooster?: BoosterType;
}

/** Which booster a listing is made of, from its name. */
function boosterNamed(n: string, plain?: BoosterType): BoosterType | null {
  if (/collector booster/i.test(n)) return "collector";
  if (/jumpstart/i.test(n)) return null;
  if (/play booster/i.test(n)) return "play";
  if (/draft booster/i.test(n)) return "draft";
  if (/\bset booster/i.test(n)) return "set";
  if (plain && /(^|\s[-–]\s)booster (box|display|pack|case)\b/i.test(n)) return plain;
  return null;
}

/**
 * What kind of sealed product a TCGplayer listing is, or null for singles and non-product
 * listings.
 */
export function classifySealed(p: TcgProduct, opts: ClassifyOptions = {}): SealedKind | null {
  const n = p.name;
  if (isSingle(p)) return null;
  if (/\b(token|art card|art series|emblem|oversized|checklist|code card)\b/i.test(n)) return null;
  if (FOREIGN.test(n)) return null;
  // "Case", "Display Case" and "MasterCase" all mean a sealed case of the product.
  const isCase = /case\b/i.test(n) && !/showcase/i.test(n);
  const booster = boosterNamed(n, opts.plainBooster);
  if (booster) {
    // Sample packs hold two or three cards, not a booster.
    if (/sample/i.test(n)) return "Other";
    if (isCase) return BOOSTER_KINDS[booster].case;
    if (/\b(display|box)\b/i.test(n)) return BOOSTER_KINDS[booster].display;
    if (booster === "play" && /sleeved/i.test(n)) return "Sleeved Play Booster";
    return BOOSTER_KINDS[booster].pack;
  }
  if (isCase) return "Case";
  if (/bundle booster/i.test(n)) return "Other";
  if (/gift bundle|bundle gift edition/i.test(n)) return "Gift Bundle";
  if (/bundle/i.test(n)) return "Bundle";
  if (/prerelease/i.test(n)) return "Prerelease Pack";
  if (/commander (deck|kit)/i.test(n) || (opts.commander && /\bdecks?\b/i.test(n))) return "Commander Deck";
  if (/starter (kit|deck|collection)|beginner box/i.test(n)) return "Starter Kit";
  if (/scene box/i.test(n)) return "Scene Box";
  if (/jumpstart/i.test(n)) return "Jumpstart";
  if (/\b(booster|display|box|deck|kit|collection|pack|set|tin|topper)\b/i.test(n)) return "Other";
  return null;
}

/** Packs in a display of each booster the set has, e.g. { play: 30, collector: 12 }. */
export type Displays = Partial<Record<BoosterType, number>>;

// Listings that share a booster's name but not its contents or its price: Special Edition
// and Omega Collector Boosters, hanger packs.
const NOT_THE_BOOSTER = /special edition|omega|hanger/i;

/**
 * Which boosters a product holds and how many, where that's fixed and known: packs,
 * multipacks, displays, Play Booster cases (six displays), and the plain "<set> - Bundle"
 * of the Play Booster era (nine). Themed bundles and older bundles vary, so they get none.
 */
export function boostersIn(kind: SealedKind, displays: Displays, name = ""): { booster: BoosterType; packs: number } | null {
  if (NOT_THE_BOOSTER.test(name)) return null;
  for (const type of BOOSTER_TYPES) {
    const k = BOOSTER_KINDS[type];
    if (kind === k.pack || (type === "play" && kind === "Sleeved Play Booster")) {
      // "Draft Booster Pack (3-Pack)"
      const multi = /\b(\d+)[-\s]pack\b/i.exec(name);
      return { booster: type, packs: multi ? Number(multi[1]) : 1 };
    }
    const display = displays[type];
    if (kind === k.display) return display ? { booster: type, packs: display } : null;
    if (kind === k.case) return type === "play" && display ? { booster: type, packs: display * 6 } : null;
  }
  if (kind === "Bundle" && displays.play && /(^|\s[-–]\s)bundle$/i.test(name.trim())) return { booster: "play", packs: 9 };
  return null;
}

const KIND_ORDER: SealedKind[] = [
  "Play Booster Display",
  "Play Booster Pack",
  "Sleeved Play Booster",
  "Play Booster Case",
  "Draft Booster Display",
  "Draft Booster Pack",
  "Draft Booster Case",
  "Set Booster Display",
  "Set Booster Pack",
  "Set Booster Case",
  "Collector Booster Display",
  "Collector Booster Pack",
  "Collector Booster Case",
  "Bundle",
  "Gift Bundle",
  "Prerelease Pack",
  "Commander Deck",
  "Starter Kit",
  "Scene Box",
  "Jumpstart",
  "Case",
  "Other",
];

export interface SealedResult {
  /** TCGplayer's market price for each booster's display, where it has one. */
  boxes: Partial<Record<BoosterType, BoxPrice>>;
  products: SealedProduct[];
}

export interface SealedQuery {
  code: string;
  name: string;
  releasedAt: string;
  displays: Displays;
}

/** Before Play Boosters, a plain "Booster Box" on TCGplayer is a Draft Booster display. */
function classifyOptions(displays: Displays): ClassifyOptions {
  return displays.play ? {} : displays.draft ? { plainBooster: "draft" } : {};
}

/**
 * Every sealed product TCGplayer lists for the set and its Commander and Jumpstart companions,
 * with today's prices, plus the display price of each booster.
 */
export async function fetchSealed(query: SealedQuery, fetchImpl: FetchLike = (u, i) => fetch(u, i)): Promise<SealedResult> {
  const get = async <T>(url: string): Promise<T[]> => {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`TCGCSV ${res.status} for ${url}`);
    return ((await res.json()) as Envelope<T>).results ?? [];
  };
  const groups = await get<TcgGroup>(`${TCGCSV}/${MAGIC}/groups`);
  const group = findGroup(groups, query.code, query.name);
  if (!group) return { boxes: {}, products: [] };
  const load = (g: TcgGroup) =>
    Promise.all([get<TcgProduct>(`${TCGCSV}/${MAGIC}/${g.groupId}/products`), get<TcgPrice>(`${TCGCSV}/${MAGIC}/${g.groupId}/prices`)]);

  const [products, prices] = await load(group);
  const result = sealedFrom(products, prices, query.displays);
  for (const companion of findCompanionGroups(groups, group, query.name, query.releasedAt)) {
    try {
      const [cp, cx] = await load(companion);
      result.products.push(...toSealed(cp, cx, query.displays, /commander/i.test(companion.name)));
    } catch {
      // A missing companion group shouldn't cost us the main set's prices.
    }
  }
  result.products.sort(bySealedOrder);
  return result;
}

function priceIndex(prices: TcgPrice[]): Map<number, TcgPrice> {
  const priceOf = new Map<number, TcgPrice>();
  for (const p of prices) {
    // Sealed product is priced under "Normal"; keep the first row we see otherwise.
    if (!priceOf.has(p.productId) || p.subTypeName === "Normal") priceOf.set(p.productId, p);
  }
  return priceOf;
}

const productUrl = (p: TcgProduct) => p.url ?? `https://www.tcgplayer.com/product/${p.productId}`;

function bySealedOrder(a: SealedProduct, b: SealedProduct): number {
  return KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (b.market ?? 0) - (a.market ?? 0) || a.name.localeCompare(b.name);
}

/** Sealed products in one TCGplayer group. `commander` marks a Commander companion group. */
export function toSealed(products: TcgProduct[], prices: TcgPrice[], displays: Displays, commander = false): SealedProduct[] {
  const priceOf = priceIndex(prices);
  const opts = { ...classifyOptions(displays), commander };
  const sealed: SealedProduct[] = [];
  for (const p of products) {
    const kind = classifySealed(p, opts);
    if (!kind) continue;
    const row = priceOf.get(p.productId);
    const inside = boostersIn(kind, displays, p.name);
    sealed.push({
      productId: p.productId,
      name: p.name,
      kind,
      market: row?.marketPrice ?? row?.midPrice ?? null,
      low: row?.lowPrice ?? null,
      packs: inside?.packs ?? null,
      booster: inside?.booster ?? null,
      url: productUrl(p),
      image: p.imageUrl ?? null,
    });
  }
  return sealed.sort(bySealedOrder);
}

export function sealedFrom(products: TcgProduct[], prices: TcgPrice[], displays: Displays): SealedResult {
  const priceOf = priceIndex(prices);
  const asOf = new Date().toISOString();
  const opts = classifyOptions(displays);
  const boxes: SealedResult["boxes"] = {};
  for (const type of BOOSTER_TYPES) {
    if (!displays[type]) continue;
    const display = findBoxProduct(products, type, opts);
    const row = display ? priceOf.get(display.productId) : undefined;
    const usd = row?.marketPrice ?? row?.midPrice ?? row?.lowPrice ?? null;
    if (display && usd != null) boxes[type] = { usd, source: "tcgplayer", productName: display.name, productUrl: productUrl(display), asOf };
  }
  return { boxes, products: toSealed(products, prices, displays) };
}
