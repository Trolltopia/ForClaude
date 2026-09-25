// Shared shapes for price snapshots. The same types are used by the browser app
// and by scripts/build-data.ts, so keep this file free of DOM or Node imports.

export type Rarity = "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus";

export type Treatment =
  | "normal"
  | "borderless"
  | "showcase"
  | "extended"
  | "fullart"
  | "guest"
  | "serialized"
  | "other";

export type Finish = "nonfoil" | "foil" | "etched";

export interface CardPrices {
  usd: number | null;
  usdFoil: number | null;
  usdEtched: number | null;
  eur: number | null;
  eurFoil: number | null;
}

export interface CardRecord {
  /** Scryfall card id. */
  id: string;
  name: string;
  /** Scryfall set code, lowercase ("fra", "spg"). */
  set: string;
  /** Collector number as printed ("12", "301a", "★"). */
  cn: string;
  rarity: Rarity;
  treatment: Treatment;
  /** Human label for the treatment, e.g. "Borderless" or "Special Guest". */
  treatmentLabel: string;
  /** Special foil name when the foil version isn't a plain traditional foil. */
  foilLabel?: string;
  finishes: Finish[];
  typeLine: string;
  colors: string[];
  isBasicLand: boolean;
  image: string | null;
  scryfallUri: string | null;
  tcgplayerId: number | null;
  prices: CardPrices;
}

/** One entry on a print sheet: [card index, relative weight, 1 if foil]. */
export type SheetEntry = [cardIndex: number, weight: number, foil: 0 | 1];

export interface Sheet {
  label: string;
  entries: SheetEntry[];
}

/** A pack layout that occurs with a given relative weight. */
export interface BoosterVariant {
  weight: number;
  contents: Record<string, number>;
}

export interface BoosterModel {
  variants: BoosterVariant[];
  sheets: Record<string, Sheet>;
}

export type ModelSource =
  | { kind: "mtgjson"; boosterName: string; note?: string }
  | { kind: "rules"; note?: string };

export interface BoxPrice {
  usd: number | null;
  source: "tcgplayer" | "estimate";
  productName?: string;
  productUrl?: string;
  asOf?: string;
}

export interface Source {
  label: string;
  url: string;
}

export type SealedKind =
  | "Play Booster Display"
  | "Play Booster Pack"
  | "Sleeved Play Booster"
  | "Play Booster Case"
  | "Bundle"
  | "Gift Bundle"
  | "Collector Booster Display"
  | "Collector Booster Pack"
  | "Collector Booster Case"
  | "Prerelease Pack"
  | "Commander Deck"
  | "Starter Kit"
  | "Scene Box"
  | "Jumpstart"
  | "Case"
  | "Other";

/** A sealed product TCGplayer lists for the set, priced today. */
export interface SealedProduct {
  productId: number;
  name: string;
  kind: SealedKind;
  /** TCGplayer market price (recent sales), falling back to the mid price. */
  market: number | null;
  /** Lowest current listing. */
  low: number | null;
  /** Play Boosters inside, when the product holds a fixed number of them. */
  packs: number | null;
  url: string;
  image: string | null;
}

export interface Snapshot {
  version: 1;
  code: string;
  name: string;
  releasedAt: string;
  iconSvg: string | null;
  product: {
    name: string;
    packsPerBox: number;
    cardsPerPack: number | null;
  };
  boxPrice: BoxPrice;
  /** Every sealed product for the set with TCGplayer prices; absent in browser-built snapshots. */
  sealed?: SealedProduct[];
  model: BoosterModel;
  modelSource: ModelSource;
  cards: CardRecord[];
  generatedAt: string;
  sources: Source[];
  notes: string[];
}

/** Summary row written to data/index.json for the home page. */
export interface SetSummary {
  code: string;
  name: string;
  releasedAt: string;
  iconSvg: string | null;
  packsPerBox: number;
  boxPrice: BoxPrice;
  evBox: number;
  evPack: number;
  /** Box price divided by expected value; null when there's no box price. */
  ratio: number | null;
  pricedShare: number;
  topCard: {
    name: string;
    price: number;
    foil: boolean;
    image: string | null;
    treatmentLabel: string;
  } | null;
  modelSource: ModelSource["kind"];
  /** Floor and fees behind evBox and ratio (older snapshots: full market price). */
  params?: { floor: number; fees: number };
}

export interface SnapshotIndex {
  version: 1;
  generatedAt: string;
  sets: SetSummary[];
}
