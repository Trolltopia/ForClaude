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

// First match wins, so the more specific names come first.
const KINDS: [RegExp, SealedKind][] = [
  [/collector booster (display|box)\b.*\bcase\b|\bcollector booster case\b/i, "Collector Booster Case"],
  [/collector booster (display|box)\b/i, "Collector Booster Display"],
  [/collector booster\b/i, "Collector Booster Pack"],
  [/play booster (display|box)\b.*\bcase\b|\bplay booster case\b/i, "Play Booster Case"],
  [/play booster (display|box)\b/i, "Play Booster Display"],
  [/sleeved play booster/i, "Sleeved Play Booster"],
  [/play booster\b/i, "Play Booster Pack"],
  [/gift bundle/i, "Gift Bundle"],
  [/bundle/i, "Bundle"],
  [/prerelease/i, "Prerelease Pack"],
  [/commander deck/i, "Commander Deck"],
  [/starter (kit|deck)|beginner box/i, "Starter Kit"],
  [/scene box/i, "Scene Box"],
  [/jumpstart/i, "Jumpstart"],
  [/\b(booster|display|box|deck|kit|collection|case|pack|set)\b/i, "Other"],
];

function isSingle(p: TcgProduct): boolean {
  return (p.extendedData ?? []).some((d) => d.name === "Number" || d.name === "Rarity");
}

/** What kind of sealed product a TCGplayer listing is, or null for singles and non-product listings. */
export function classifySealed(p: TcgProduct): SealedKind | null {
  if (isSingle(p)) return null;
  if (/\b(token|art card|art series|emblem|oversized|checklist|code card)\b/i.test(p.name)) return null;
  for (const [re, kind] of KINDS) if (re.test(p.name)) return kind;
  return null;
}

/** How many Play Boosters a product holds, where that's fixed and known. */
export function playBoostersIn(kind: SealedKind, packsPerBox: number): number | null {
  switch (kind) {
    case "Play Booster Pack":
    case "Sleeved Play Booster":
      return 1;
    case "Play Booster Display":
      return packsPerBox;
    case "Play Booster Case":
      return packsPerBox * 6;
    case "Bundle":
      // Bundles since 2024 hold nine Play Boosters, plus lands, a promo and a spindown.
      return 9;
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
  "Other",
];

export interface SealedResult {
  box: BoxPrice | null;
  products: SealedProduct[];
}

/** Every sealed product TCGplayer lists for the set, with today's prices, plus the Play Booster display price. */
export async function fetchSealed(
  code: string,
  name: string,
  packsPerBox: number,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
): Promise<SealedResult> {
  const get = async <T>(url: string): Promise<T[]> => {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`TCGCSV ${res.status} for ${url}`);
    return ((await res.json()) as Envelope<T>).results ?? [];
  };
  const group = findGroup(await get<TcgGroup>(`${TCGCSV}/${MAGIC}/groups`), code, name);
  if (!group) return { box: null, products: [] };
  const [products, prices] = await Promise.all([
    get<TcgProduct>(`${TCGCSV}/${MAGIC}/${group.groupId}/products`),
    get<TcgPrice>(`${TCGCSV}/${MAGIC}/${group.groupId}/prices`),
  ]);
  return sealedFrom(products, prices, packsPerBox);
}

export function sealedFrom(products: TcgProduct[], prices: TcgPrice[], packsPerBox: number): SealedResult {
  const priceOf = new Map<number, TcgPrice>();
  for (const p of prices) {
    // Sealed product is priced under "Normal"; keep the first row we see otherwise.
    if (!priceOf.has(p.productId) || p.subTypeName === "Normal") priceOf.set(p.productId, p);
  }
  const asOf = new Date().toISOString();
  const url = (p: TcgProduct) => p.url ?? `https://www.tcgplayer.com/product/${p.productId}`;

  const sealed: SealedProduct[] = [];
  for (const p of products) {
    const kind = classifySealed(p);
    if (!kind) continue;
    const row = priceOf.get(p.productId);
    sealed.push({
      productId: p.productId,
      name: p.name,
      kind,
      market: row?.marketPrice ?? row?.midPrice ?? null,
      low: row?.lowPrice ?? null,
      packs: playBoostersIn(kind, packsPerBox),
      url: url(p),
      image: p.imageUrl ?? null,
    });
  }
  sealed.sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind) || (b.market ?? 0) - (a.market ?? 0) || a.name.localeCompare(b.name),
  );

  const display = findPlayBoxProduct(products);
  const row = display ? priceOf.get(display.productId) : undefined;
  const usd = row?.marketPrice ?? row?.midPrice ?? row?.lowPrice ?? null;
  const box: BoxPrice | null =
    display && usd != null ? { usd, source: "tcgplayer", productName: display.name, productUrl: url(display), asOf } : null;
  return { box, products: sealed };
}
