import type { BoxPrice, SealedKind, SealedProduct } from "../types";
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
 * TCGplayer files a set's Commander precons under a companion group such as
 * "Commander: Bloomburrow". Match on the set's leading name and a release date
 * within two months, so "Commander: Duskmourn" pairs with "Duskmourn: House of Horror".
 */
export function findCommanderGroups(groups: TcgGroup[], main: TcgGroup, setName: string, releasedAt: string): TcgGroup[] {
  const key = setName.split(":")[0].trim().toLowerCase();
  const released = Date.parse(releasedAt.slice(0, 10));
  const WINDOW = 60 * 86_400_000;
  return groups.filter((g) => {
    if (g.groupId === main.groupId || !/commander/i.test(g.name)) return false;
    if (!g.name.toLowerCase().includes(key)) return false;
    const published = g.publishedOn ? Date.parse(g.publishedOn.slice(0, 10)) : Number.NaN;
    return Number.isNaN(published) || Number.isNaN(released) || Math.abs(published - released) <= WINDOW;
  });
}

/** The Play Booster display (the 30- or 36-pack box), not a case, bundle, or single pack. */
export function findPlayBoxProduct(products: TcgProduct[]): TcgProduct | null {
  const candidates = products.filter(
    (p) =>
      /play booster (display|box)\b/i.test(p.name) &&
      !/\b(case|bundle|collector|sleeved|japanese|jumpstart|prerelease)\b/i.test(p.name),
  );
  candidates.sort((a, b) => Number(/display/i.test(b.name)) - Number(/display/i.test(a.name)));
  return candidates[0] ?? null;
}

function isSingle(p: TcgProduct): boolean {
  return (p.extendedData ?? []).some((d) => d.name === "Number" || d.name === "Rarity");
}

// Other-language printings: priced against English singles they'd be misleading.
const FOREIGN = /\((japanese|jp|chinese|korean|german|french|italian|spanish|portuguese|russian)\)|\bjapanese\b/i;

/**
 * What kind of sealed product a TCGplayer listing is, or null for singles and non-product
 * listings. In a Commander companion group, any sealed deck is a Commander precon.
 */
export function classifySealed(p: TcgProduct, opts: { commander?: boolean } = {}): SealedKind | null {
  const n = p.name;
  if (isSingle(p)) return null;
  if (/\b(token|art card|art series|emblem|oversized|checklist|code card)\b/i.test(n)) return null;
  if (FOREIGN.test(n)) return null;
  // "Case", "Display Case" and "MasterCase" all mean a sealed case of the product.
  const isCase = /case\b/i.test(n) && !/showcase/i.test(n);
  if (/collector booster/i.test(n)) {
    if (isCase) return "Collector Booster Case";
    return /\b(display|box)\b/i.test(n) ? "Collector Booster Display" : "Collector Booster Pack";
  }
  if (/play booster/i.test(n) && !/jumpstart/i.test(n)) {
    if (isCase) return "Play Booster Case";
    if (/\b(display|box)\b/i.test(n)) return "Play Booster Display";
    if (/sleeved/i.test(n)) return "Sleeved Play Booster";
    return "Play Booster Pack";
  }
  if (isCase) return "Case";
  if (/bundle booster/i.test(n)) return "Other";
  if (/gift bundle/i.test(n)) return "Gift Bundle";
  if (/bundle/i.test(n)) return "Bundle";
  if (/prerelease/i.test(n)) return "Prerelease Pack";
  if (/commander deck/i.test(n) || (opts.commander && /\bdecks?\b/i.test(n))) return "Commander Deck";
  if (/starter (kit|deck|collection)|beginner box/i.test(n)) return "Starter Kit";
  if (/scene box/i.test(n)) return "Scene Box";
  if (/jumpstart/i.test(n)) return "Jumpstart";
  if (/\b(booster|display|box|deck|kit|collection|pack|set|tin|topper)\b/i.test(n)) return "Other";
  return null;
}

/**
 * How many Play Boosters a product holds, where that's fixed and known. Only the plain
 * "<set> - Bundle" counts as nine; themed bundles (Finish Line, Codex, Commander's…) differ.
 */
export function playBoostersIn(kind: SealedKind, packsPerBox: number, name = ""): number | null {
  switch (kind) {
    case "Play Booster Pack":
    case "Sleeved Play Booster":
      return 1;
    case "Play Booster Display":
      return packsPerBox;
    case "Play Booster Case":
      return packsPerBox * 6;
    case "Bundle":
      return /(^|\s[-–]\s)bundle$/i.test(name.trim()) ? 9 : null;
    default:
      return null;
  }
}

const KIND_ORDER: SealedKind[] = [
  "Play Booster Display",
  "Play Booster Pack",
  "Sleeved Play Booster",
  "Play Booster Case",
  "Bundle",
  "Gift Bundle",
  "Collector Booster Display",
  "Collector Booster Pack",
  "Collector Booster Case",
  "Prerelease Pack",
  "Commander Deck",
  "Starter Kit",
  "Scene Box",
  "Jumpstart",
  "Case",
  "Other",
];

export interface SealedResult {
  box: BoxPrice | null;
  products: SealedProduct[];
}

/**
 * Every sealed product TCGplayer lists for the set and its Commander companion set,
 * with today's prices, plus the Play Booster display price.
 */
export async function fetchSealed(
  code: string,
  name: string,
  packsPerBox: number,
  releasedAt: string,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
): Promise<SealedResult> {
  const get = async <T>(url: string): Promise<T[]> => {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`TCGCSV ${res.status} for ${url}`);
    return ((await res.json()) as Envelope<T>).results ?? [];
  };
  const groups = await get<TcgGroup>(`${TCGCSV}/${MAGIC}/groups`);
  const group = findGroup(groups, code, name);
  if (!group) return { box: null, products: [] };
  const load = (g: TcgGroup) =>
    Promise.all([get<TcgProduct>(`${TCGCSV}/${MAGIC}/${g.groupId}/products`), get<TcgPrice>(`${TCGCSV}/${MAGIC}/${g.groupId}/prices`)]);

  const [products, prices] = await load(group);
  const result = sealedFrom(products, prices, packsPerBox);
  for (const commander of findCommanderGroups(groups, group, name, releasedAt)) {
    try {
      const [cp, cx] = await load(commander);
      result.products.push(...toSealed(cp, cx, packsPerBox, true));
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
export function toSealed(products: TcgProduct[], prices: TcgPrice[], packsPerBox: number, commander = false): SealedProduct[] {
  const priceOf = priceIndex(prices);
  const sealed: SealedProduct[] = [];
  for (const p of products) {
    const kind = classifySealed(p, { commander });
    if (!kind) continue;
    const row = priceOf.get(p.productId);
    sealed.push({
      productId: p.productId,
      name: p.name,
      kind,
      market: row?.marketPrice ?? row?.midPrice ?? null,
      low: row?.lowPrice ?? null,
      packs: playBoostersIn(kind, packsPerBox, p.name),
      url: productUrl(p),
      image: p.imageUrl ?? null,
    });
  }
  return sealed.sort(bySealedOrder);
}

export function sealedFrom(products: TcgProduct[], prices: TcgPrice[], packsPerBox: number): SealedResult {
  const priceOf = priceIndex(prices);
  const asOf = new Date().toISOString();
  const url = productUrl;
  const sealed = toSealed(products, prices, packsPerBox);

  const display = findPlayBoxProduct(products);
  const row = display ? priceOf.get(display.productId) : undefined;
  const usd = row?.marketPrice ?? row?.midPrice ?? row?.lowPrice ?? null;
  const box: BoxPrice | null =
    display && usd != null ? { usd, source: "tcgplayer", productName: display.name, productUrl: url(display), asOf } : null;
  return { box, products: sealed };
}
