import type { BoxPrice } from "../types";
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

export async function fetchBoxPrice(
  code: string,
  name: string,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
): Promise<BoxPrice | null> {
  const get = async <T>(url: string): Promise<T[]> => {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`TCGCSV ${res.status} for ${url}`);
    return ((await res.json()) as Envelope<T>).results ?? [];
  };
  const group = findGroup(await get<TcgGroup>(`${TCGCSV}/${MAGIC}/groups`), code, name);
  if (!group) return null;
  const product = findPlayBoxProduct(await get<TcgProduct>(`${TCGCSV}/${MAGIC}/${group.groupId}/products`));
  if (!product) return null;
  const prices = await get<TcgPrice>(`${TCGCSV}/${MAGIC}/${group.groupId}/prices`);
  const row = prices.find((p) => p.productId === product.productId);
  const usd = row?.marketPrice ?? row?.midPrice ?? row?.lowPrice ?? null;
  if (usd == null) return null;
  return {
    usd,
    source: "tcgplayer",
    productName: product.name,
    productUrl: product.url ?? `https://www.tcgplayer.com/product/${product.productId}`,
    asOf: new Date().toISOString(),
  };
}
