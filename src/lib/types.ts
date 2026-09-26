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
  | "Draft Booster Display"
  | "Draft Booster Pack"
  | "Draft Booster Case"
  | "Set Booster Display"
  | "Set Booster Pack"
  | "Set Booster Case"
  | "Collector Booster Display"
  | "Collector Booster Pack"
  | "Collector Booster Case"
  | "Bundle"
  | "Gift Bundle"
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
  /** Boosters inside, when the product holds a fixed number of one kind. */
  packs: number | null;
  /** Which booster `packs` counts. */
  booster: BoosterType | null;
  url: string;
  image: string | null;
}

/**
 * The booster products we price. Play Boosters replaced Draft and Set Boosters with
 * Murders at Karlov Manor (2024); Collector Boosters run alongside both.
 */
export type BoosterType = "play" | "draft" | "set" | "collector";

/** One booster product of a set: its pack model and what a sealed display of it costs. */
export interface BoosterProduct {
  type: BoosterType;
  /** "Play Booster", "Collector Booster". */
  name: string;
  packsPerBox: number;
  cardsPerPack: number | null;
  boxPrice: BoxPrice;
  model: BoosterModel;
  modelSource: ModelSource;
  /** Caveats that apply to this booster only. */
  notes: string[];
}

/** data/<code>.json: a set, each booster product it has, and the card pool they share. */
export interface SetSnapshot {
  version: 2;
  code: string;
  name: string;
  releasedAt: string;
  iconSvg: string | null;
  /** Main booster first (Play, or Draft before 2024), then Set and Collector. */
  boosters: BoosterProduct[];
  /** Every sealed product for the set with TCGplayer prices; absent in browser-built snapshots. */
  sealed?: SealedProduct[];
  /** Model entries of every booster index into this list. */
  cards: CardRecord[];
  generatedAt: string;
  sources: Source[];
  notes: string[];
}

/** One booster of one set, flattened: what the calculator, charts and simulation work on. */
export interface Snapshot {
  code: string;
  name: string;
  releasedAt: string;
  iconSvg: string | null;
  booster: BoosterType;
  product: {
    name: string;
    packsPerBox: number;
    cardsPerPack: number | null;
  };
  boxPrice: BoxPrice;
  sealed?: SealedProduct[];
  model: BoosterModel;
  modelSource: ModelSource;
  cards: CardRecord[];
  generatedAt: string;
  sources: Source[];
  notes: string[];
}

/** One booster's numbers in data/index.json. */
export interface BoosterSummary {
  type: BoosterType;
  name: string;
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
  /**
   * Card value per box before fees at each minimum card price in FLOOR_STEPS, so the board
   * can show value at anyone's settings. Absent in older indexes.
   */
  gross?: number[];
}

/** Summary row written to data/index.json for the home page. */
export interface SetSummary {
  code: string;
  name: string;
  releasedAt: string;
  iconSvg: string | null;
  /** Main booster first, as in the snapshot. */
  boosters: BoosterSummary[];
  /** Floor and fees behind evBox and ratio; `gross` lets readers apply their own. */
  params: { floor: number; fees: number };
}

export interface SnapshotIndex {
  version: 2;
  generatedAt: string;
  sets: SetSummary[];
}

/** Products with fixed contents, valued as the sum of their cards: Commander precons and Secret Lair drops. */
export type FixedKind = "commander" | "secret-lair";

export type CardFinish = "nonfoil" | "foil" | "etched";

/** A card in a fixed product, with the finish and number of copies the product holds. */
export interface FixedCard {
  /** Scryfall card id. */
  id: string;
  name: string;
  set: string;
  cn: string;
  rarity: Rarity;
  treatmentLabel: string;
  finish: CardFinish;
  count: number;
  /** TCGplayer market price for this finish, or null without sales. */
  price: number | null;
  image: string | null;
  scryfallUri: string | null;
  /** The deck's commander. */
  commander?: boolean;
}

/** data/decks/<id>.json and data/secret-lair/<id>.json. */
export interface FixedProduct {
  version: 1;
  id: string;
  kind: FixedKind;
  name: string;
  /** MTGJSON set code the product belongs to, e.g. "FDC" or "SLD". */
  setCode: string;
  setName: string;
  releasedAt: string;
  /** TCGplayer market price of the sealed product. */
  price: BoxPrice;
  tcgplayerId: number | null;
  cards: FixedCard[];
  generatedAt: string;
  notes: string[];
}

/** One row of data/decks.json or data/secret-lair.json. */
export interface FixedSummary {
  id: string;
  kind: FixedKind;
  name: string;
  setCode: string;
  setName: string;
  releasedAt: string;
  price: BoxPrice;
  /** TCGplayer product id of the sealed product, for linking from a set's sealed list. */
  tcgplayerId: number | null;
  /** [price, copies] for every priced card, so value follows anyone's settings exactly. */
  values: [number, number][];
  cardCount: number;
  /** Share of cards (by copies) that have a price. */
  pricedShare: number;
  topCard: { name: string; price: number; finish: CardFinish; image: string | null } | null;
  commanders: string[];
}

export interface FixedIndex {
  version: 1;
  kind: FixedKind;
  generatedAt: string;
  products: FixedSummary[];
}
