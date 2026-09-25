import type { CardRecord, Rarity, Treatment } from "../src/lib/types";

let n = 0;

export function card(
  partial: Partial<CardRecord> & { usd?: number | null; usdFoil?: number | null } = {},
): CardRecord {
  n++;
  const { usd = 1, usdFoil = null, ...rest } = partial;
  return {
    id: `id-${n}`,
    name: `Card ${n}`,
    set: "tst",
    cn: String(n),
    rarity: "common" as Rarity,
    treatment: "normal" as Treatment,
    treatmentLabel: "Regular",
    finishes: ["nonfoil", "foil"],
    typeLine: "Creature — Test",
    colors: [],
    isBasicLand: false,
    image: null,
    scryfallUri: null,
    tcgplayerId: null,
    prices: { usd, usdFoil, usdEtched: null, eur: null, eurFoil: null },
    ...rest,
  };
}
