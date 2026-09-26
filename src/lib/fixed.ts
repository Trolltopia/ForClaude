import type { Settings } from "./settings";
import { returnOf, verdictFor, type Verdict } from "./verdict";
import type { CardFinish, CardRecord, FixedKind, FixedProduct, FixedSummary } from "./types";

/** Where each kind lives: /decks and data/decks.json, /secret-lair and data/secret-lair.json. */
export const FIXED_PATH: Record<FixedKind, string> = { commander: "decks", "secret-lair": "secret-lair" };

export const FIXED_NAME: Record<FixedKind, { one: string; many: string }> = {
  commander: { one: "Commander deck", many: "Commander decks" },
  "secret-lair": { one: "Secret Lair drop", many: "Secret Lair drops" },
};

/** A card's TCGplayer market price in the finish a product holds it in. */
export function priceInFinish(card: Pick<CardRecord, "prices" | "finishes">, finish: CardFinish): number | null {
  const p = card.prices;
  if (finish === "etched") return p.usdEtched ?? p.usdFoil;
  if (finish === "foil") return p.usdFoil ?? p.usdEtched;
  return p.usd ?? (card.finishes.includes("nonfoil") ? null : (p.usdFoil ?? p.usdEtched));
}

/** What one card is worth to the person selling it: fees off, nothing under the minimum price. */
export function cardValue(price: number | null, s: Settings): number {
  return price != null && price >= s.floor ? price * (1 - s.fees / 100) : 0;
}

/** Everything in the product at the reader's settings. */
export function fixedValue(values: [number, number][], s: Settings): number {
  let total = 0;
  for (const [price, copies] of values) total += cardValue(price, s) * copies;
  return total;
}

export function summariseFixed(p: FixedProduct): FixedSummary {
  const priced = p.cards.filter((c) => c.price != null);
  const copies = p.cards.reduce((s, c) => s + c.count, 0);
  const top = [...priced].sort((a, b) => b.price! - a.price!)[0];
  return {
    id: p.id,
    kind: p.kind,
    name: p.name,
    setCode: p.setCode,
    setName: p.setName,
    releasedAt: p.releasedAt,
    price: p.price,
    tcgplayerId: p.tcgplayerId,
    values: priced.map((c) => [Math.round(c.price! * 100) / 100, c.count]),
    cardCount: copies,
    pricedShare: copies ? priced.reduce((s, c) => s + c.count, 0) / copies : 0,
    topCard: top ? { name: top.name, price: top.price!, finish: top.finish, image: top.image } : null,
    commanders: p.cards.filter((c) => c.commander).map((c) => c.name),
  };
}

/** "Calling All Angels" + "FDC" → "calling-all-angels-fdc". */
export function fixedId(name: string, setCode: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base}-${setCode.toLowerCase()}`;
}

/** Below this share of priced copies, a product's card value is only a floor. */
export const PRICED_ENOUGH = 0.95;

export function isComplete(pricedShare: number): boolean {
  return pricedShare >= PRICED_ENOUGH;
}

/** The return on the sealed price, or null when too few cards have a price to say anything. */
export function fixedReturn(price: number | null, value: number, pricedShare: number): number | null {
  return pricedShare >= 0.5 ? returnOf(price, value) : null;
}

/**
 * The verdict for a deck or drop. Cards without a price count as nothing, so with prices
 * missing the value is a floor: enough to say the cards beat the sealed price, never that
 * they fall short. Then there's no verdict.
 */
export function fixedVerdict(ret: number | null, pricedShare: number, releasedAt: string): Verdict | null {
  const v = verdictFor(ret, releasedAt);
  if (!v || v === "early" || v === "crack" || isComplete(pricedShare)) return v;
  return null;
}
