import type { BoosterModel, CardRecord, Snapshot } from "../types";

export interface EvParams {
  /** Cards whose market price is below this are counted as worthless (bulk). */
  floor: number;
  /** Share of the sale price lost to fees and shipping, 0–1. */
  fees: number;
}

/** Selling fees taken off every card by default: roughly what a marketplace and payment processing cost. */
export const DEFAULT_FEES = 0.08;

export const DEFAULT_PARAMS: EvParams = { floor: 0, fees: DEFAULT_FEES };

/** Every card at full market price — the number most EV sites lead with. */
export const MARKET_PARAMS: EvParams = { floor: 0, fees: 0 };

/**
 * USD market price for a card in the given finish. Foil-only printings keep their
 * price in the foil column on Scryfall, so a nonfoil slot falls back to it only
 * when the card has no nonfoil finish at all.
 */
export function priceOf(card: CardRecord, foil: boolean): number | null {
  const p = card.prices;
  if (foil) return p.usdFoil ?? p.usdEtched;
  if (p.usd != null) return p.usd;
  return card.finishes.includes("nonfoil") ? null : (p.usdFoil ?? p.usdEtched);
}

/** What a card is worth to the person opening the box, after the bulk floor and fees. */
export function realisedValue(price: number | null, params: EvParams): number {
  if (price == null || price < params.floor) return 0;
  return price * (1 - params.fees);
}

/** Expected number of cards drawn from each sheet in one pack. */
export function expectedSheetCounts(model: BoosterModel): Record<string, number> {
  const total = model.variants.reduce((s, v) => s + v.weight, 0);
  const out: Record<string, number> = {};
  if (total <= 0) return out;
  for (const v of model.variants) {
    for (const [sheet, n] of Object.entries(v.contents)) {
      out[sheet] = (out[sheet] ?? 0) + (v.weight / total) * n;
    }
  }
  return out;
}

export interface SheetStat {
  key: string;
  label: string;
  /** Average number of cards from this sheet in a pack. */
  perPack: number;
  /** Average realised value of one card drawn from the sheet. */
  avgValue: number;
  evPack: number;
  evBox: number;
  share: number;
  distinctCards: number;
  foil: "foil" | "nonfoil" | "mixed";
}

export interface CardStat {
  /** Stable key: card index plus finish. */
  key: string;
  index: number;
  card: CardRecord;
  foil: boolean;
  price: number | null;
  value: number;
  /** Expected copies in one pack. */
  perPack: number;
  /** Expected copies in one box. */
  perBox: number;
  /** Chance of opening at least one copy in a box. */
  chanceInBox: number;
  /** Contribution to the box's expected value. */
  evBox: number;
  share: number;
}

export interface EvResult {
  evPack: number;
  evBox: number;
  packsPerBox: number;
  sheets: SheetStat[];
  cards: CardStat[];
  /** Share of expected pack contents (by card count) that has a price. */
  pricedShare: number;
  /** Share of box EV that comes from the ten biggest contributors. */
  top10Share: number;
}

export function computeEv(snapshot: Pick<Snapshot, "model" | "cards" | "product">, params: EvParams): EvResult {
  const { model, cards } = snapshot;
  const packs = snapshot.product.packsPerBox;
  const counts = expectedSheetCounts(model);
  const byKey = new Map<string, CardStat>();
  const sheets: SheetStat[] = [];
  let pricedCards = 0;
  let allCards = 0;

  for (const [key, sheet] of Object.entries(model.sheets)) {
    const perPack = counts[key] ?? 0;
    const total = sheet.entries.reduce((s, e) => s + e[1], 0);
    if (perPack <= 0 || total <= 0) continue;

    let avgValue = 0;
    let foils = 0;
    for (const [index, weight, foilFlag] of sheet.entries) {
      const card = cards[index];
      if (!card) continue;
      const foil = foilFlag === 1;
      const p = weight / total;
      const price = priceOf(card, foil);
      const value = realisedValue(price, params);
      avgValue += p * value;
      if (foil) foils++;
      if (price != null) pricedCards += perPack * p;
      allCards += perPack * p;

      const statKey = `${index}:${foil ? "f" : "n"}`;
      let stat = byKey.get(statKey);
      if (!stat) {
        stat = {
          key: statKey,
          index,
          card,
          foil,
          price,
          value,
          perPack: 0,
          perBox: 0,
          chanceInBox: 0,
          evBox: 0,
          share: 0,
        };
        byKey.set(statKey, stat);
      }
      stat.perPack += perPack * p;
    }

    sheets.push({
      key,
      label: sheet.label,
      perPack,
      avgValue,
      evPack: perPack * avgValue,
      evBox: perPack * avgValue * packs,
      share: 0,
      distinctCards: sheet.entries.length,
      foil: foils === 0 ? "nonfoil" : foils === sheet.entries.length ? "foil" : "mixed",
    });
  }

  const evPack = sheets.reduce((s, x) => s + x.evPack, 0);
  const evBox = evPack * packs;
  for (const s of sheets) s.share = evBox > 0 ? s.evBox / evBox : 0;
  sheets.sort((a, b) => b.evBox - a.evBox);

  const cardStats = [...byKey.values()];
  for (const c of cardStats) {
    c.perBox = c.perPack * packs;
    c.chanceInBox = 1 - Math.exp(-c.perBox);
    c.evBox = c.perBox * c.value;
    c.share = evBox > 0 ? c.evBox / evBox : 0;
  }
  cardStats.sort((a, b) => b.evBox - a.evBox || (b.price ?? 0) - (a.price ?? 0));

  const top10Share = cardStats.slice(0, 10).reduce((s, c) => s + c.share, 0);

  return {
    evPack,
    evBox,
    packsPerBox: packs,
    sheets,
    cards: cardStats,
    pricedShare: allCards > 0 ? pricedCards / allCards : 0,
    top10Share,
  };
}

/** The single most expensive card you can open, in any finish, with its price. */
export function mostValuable(snapshot: Pick<Snapshot, "model" | "cards">) {
  let best: { card: CardRecord; foil: boolean; price: number } | null = null;
  for (const sheet of Object.values(snapshot.model.sheets)) {
    for (const [index, , foilFlag] of sheet.entries) {
      const card = snapshot.cards[index];
      if (!card) continue;
      const price = priceOf(card, foilFlag === 1);
      if (price != null && (!best || price > best.price)) best = { card, foil: foilFlag === 1, price };
    }
  }
  return best;
}
