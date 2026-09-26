import { describe, expect, it } from "vitest";
import { buildFixedProducts, deckContents, fixedKindOf } from "../src/lib/data/decks";
import type { MtgjsonSetFile } from "../src/lib/data/mtgjson";
import { createScryfallClient, type ScryfallCard } from "../src/lib/data/scryfall";
import { fixedId, fixedValue, priceInFinish, summariseFixed } from "../src/lib/fixed";

const sf = (id: string, prices: ScryfallCard["prices"], extra: Partial<ScryfallCard> = {}): ScryfallCard => ({
  object: "card",
  id,
  name: id,
  set: "tsc",
  collector_number: "1",
  rarity: "rare",
  border_color: "black",
  finishes: ["nonfoil", "foil", "etched"],
  type_line: "Creature — Elf",
  prices,
  image_uris: { normal: `https://img/${id}.jpg` },
  ...extra,
});

const scry = [
  sf("commander", { usd: "4", usd_foil: "9", usd_etched: "12" }),
  sf("ring", { usd: "1.5", usd_foil: "3" }),
  sf("bulk", { usd: "0.1", usd_foil: "0.2" }),
  sf("chase", { usd: "40", usd_foil: "55" }),
];

function fakeClient() {
  let collectionCalls = 0;
  const client = createScryfallClient({
    delayMs: 0,
    fetch: async (url, init) => {
      if (url.includes("/cards/collection")) {
        collectionCalls++;
        const ids = (JSON.parse(String(init?.body)).identifiers as { id: string }[]).map((x) => x.id);
        return new Response(JSON.stringify({ object: "list", data: scry.filter((c) => ids.includes(c.id)), not_found: [] }), { status: 200 });
      }
      return new Response("{}", { status: 404 });
    },
  });
  return { client, calls: () => collectionCalls };
}

const setFile: MtgjsonSetFile = {
  data: {
    code: "TSC",
    name: "Test Commander",
    tcgplayerGroupId: 77,
    cards: scry.map((c) => ({ uuid: `u-${c.id}`, name: c.name, number: "1", setCode: "TSC", identifiers: { scryfallId: c.id } })),
    sealedProduct: [
      { uuid: "sp-1", name: "Test Commander Deck Elves", category: "deck", identifiers: { tcgplayerProductId: "5001" } },
      { uuid: "sp-2", name: "Test Commander Deck Rings", category: "deck", identifiers: { tcgplayerProductId: "5002" } },
    ],
    decks: [
      {
        code: "TSC",
        name: "Elves",
        type: "Commander Deck",
        releaseDate: "2026-01-01",
        commander: [{ count: 1, uuid: "u-commander", isEtched: true }],
        mainBoard: [
          { count: 1, uuid: "u-ring" },
          { count: 30, uuid: "u-bulk" },
          { count: 1, uuid: "u-chase", isFoil: true },
          { count: 1, uuid: "u-missing" },
        ],
        sealedProductUuids: ["sp-1"],
      },
      { code: "TSC", name: "Rings", type: "Commander Deck", mainBoard: [{ count: 1, uuid: "u-ring" }], sealedProductUuids: ["sp-2"] },
    ],
  },
};

const entries = [
  { code: "TSC", fileName: "Elves_TSC", name: "Elves", releaseDate: "2026-01-01", type: "Commander Deck" },
  { code: "TSC", fileName: "Rings_TSC", name: "Rings", releaseDate: "2026-01-01", type: "Commander Deck" },
];

const tcgGroup = async (groupId: number) => {
  expect(groupId).toBe(77);
  return {
    products: [
      { productId: 5001, name: "Test Commander Deck - Elves", url: "https://www.tcgplayer.com/product/5001/elves" },
      { productId: 5002, name: "Test Commander Deck - Rings" },
    ],
    prices: [
      { productId: 5001, marketPrice: 50, subTypeName: "Normal" },
      { productId: 5002, marketPrice: null, midPrice: null, lowPrice: null, subTypeName: "Normal" },
    ],
  };
};

describe("fixed products", () => {
  it("knows which deck lists we price", () => {
    expect(fixedKindOf("Commander Deck")).toBe("commander");
    expect(fixedKindOf("Secret Lair Drop")).toBe("secret-lair");
    expect(fixedKindOf("Theme Deck")).toBeNull();
  });

  it("reads a deck's cards with their finishes, commander first", () => {
    const cards = deckContents(setFile.data.decks![0]);
    expect(cards[0]).toEqual({ uuid: "u-commander", count: 1, finish: "etched", commander: true });
    expect(cards.find((c) => c.uuid === "u-chase")?.finish).toBe("foil");
    expect(cards.find((c) => c.uuid === "u-bulk")?.count).toBe(30);
  });

  it("prices a card in the finish the product holds", () => {
    const card = { prices: { usd: 4, usdFoil: 9, usdEtched: 12, eur: null, eurFoil: null }, finishes: ["nonfoil", "foil", "etched"] as const };
    expect(priceInFinish({ ...card, finishes: [...card.finishes] }, "etched")).toBe(12);
    expect(priceInFinish({ ...card, finishes: [...card.finishes] }, "foil")).toBe(9);
    expect(priceInFinish({ ...card, finishes: [...card.finishes] }, "nonfoil")).toBe(4);
    expect(priceInFinish({ prices: { usd: null, usdFoil: 7, usdEtched: null, eur: null, eurFoil: null }, finishes: ["foil"] }, "nonfoil")).toBe(7);
  });

  it("builds each deck with its sealed price and its cards, in one Scryfall pass", async () => {
    const { client, calls } = fakeClient();
    const [elves, rings] = await buildFixedProducts(entries, { client, mtgjson: async (c) => (c === "TSC" ? setFile : null), tcgGroup });
    expect(calls()).toBe(1);
    expect(elves.id).toBe("elves-tsc");
    expect(elves.price).toMatchObject({ usd: 50, source: "tcgplayer", productUrl: "https://www.tcgplayer.com/product/5001/elves" });
    expect(elves.tcgplayerId).toBe(5001);
    const byId = new Map(elves.cards.map((c) => [c.id, c]));
    expect(byId.get("commander")).toMatchObject({ finish: "etched", price: 12, commander: true });
    expect(byId.get("chase")).toMatchObject({ finish: "foil", price: 55 });
    expect(byId.get("bulk")).toMatchObject({ count: 30, price: 0.1 });
    expect(elves.notes.some((n) => n.startsWith("1 card in the list could not be matched"))).toBe(true);
    expect(rings.price.usd).toBeNull();
    expect(rings.notes).toContain("TCGplayer has no market price for the sealed product yet.");
  });

  it("values the cards at anyone's settings", async () => {
    const { client } = fakeClient();
    const [elves] = await buildFixedProducts(entries, { client, mtgjson: async () => setFile, tcgGroup });
    const s = summariseFixed(elves);
    expect(s.commanders).toEqual(["commander"]);
    expect(s.cardCount).toBe(33);
    expect(s.topCard?.name).toBe("chase");
    // 12 + 1.5 + 30 × 0.10 + 55 = 71.50 at market price.
    expect(fixedValue(s.values, { floor: 0, fees: 0 })).toBeCloseTo(71.5);
    // Ignoring cards under 25¢ drops the thirty bulk commons; 8% fees come off the rest.
    expect(fixedValue(s.values, { floor: 0.25, fees: 8 })).toBeCloseTo(68.5 * 0.92);
  });

  it("makes readable ids", () => {
    expect(fixedId("Calling All Angels", "FDC")).toBe("calling-all-angels-fdc");
    expect(fixedId("Éowyn's “Shieldmaiden” Deck!", "LTC")).toBe("eowyn-s-shieldmaiden-deck-ltc");
  });
});
