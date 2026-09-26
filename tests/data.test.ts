import { describe, expect, it } from "vitest";
import { boosterView } from "../src/lib/boosters";
import { computeEv } from "../src/lib/engine/ev";
import { buildSetSnapshot, summarise } from "../src/lib/data/build";
import { boosterConfig, buildModelFromMtgjson, sheetLabel, type MtgjsonBoosterConfig, type MtgjsonSetFile } from "../src/lib/data/mtgjson";
import { buildModelFromRules, rulesQueries, type RulesConfig } from "../src/lib/data/rules";
import { collectorNumber, createScryfallClient, normaliseCard, type ScryfallCard } from "../src/lib/data/scryfall";
import { findBoxProduct, findGroup } from "../src/lib/data/tcgcsv";
import type { CatalogEntry } from "../src/sets/catalog";
import { card } from "./helpers";

function sf(partial: Partial<ScryfallCard> & { id: string }): ScryfallCard {
  return {
    object: "card",
    name: partial.id,
    set: "tst",
    collector_number: "1",
    rarity: "common",
    border_color: "black",
    finishes: ["nonfoil", "foil"],
    type_line: "Creature — Elf",
    prices: { usd: "0.10", usd_foil: "0.25" },
    image_uris: { normal: `https://img/${partial.id}.jpg` },
    ...partial,
  };
}

describe("normaliseCard", () => {
  it("derives treatments and prices", () => {
    const borderless = normaliseCard(sf({ id: "a", rarity: "mythic", border_color: "borderless", prices: { usd: "12.5", usd_foil: null } }));
    expect(borderless.treatment).toBe("borderless");
    expect(borderless.prices.usd).toBe(12.5);
    expect(borderless.prices.usdFoil).toBeNull();

    expect(normaliseCard(sf({ id: "b", frame_effects: ["showcase"] })).treatmentLabel).toBe("Showcase");
    expect(normaliseCard(sf({ id: "c", frame_effects: ["extendedart"] })).treatment).toBe("extended");
    expect(normaliseCard(sf({ id: "d", set: "spg" })).treatment).toBe("guest");

    const land = normaliseCard(sf({ id: "e", type_line: "Basic Land — Forest", full_art: true, border_color: "borderless" }));
    expect(land.isBasicLand).toBe(true);
    expect(land.treatment).toBe("fullart");

    const foil = normaliseCard(sf({ id: "f", promo_types: ["surgefoil"] }));
    expect(foil.foilLabel).toBe("Surge foil");
  });

  it("reads images from the front face of double-faced cards", () => {
    const dfc = normaliseCard(
      sf({
        id: "g",
        image_uris: undefined,
        type_line: undefined,
        card_faces: [{ type_line: "Creature — Werewolf", image_uris: { normal: "front.jpg" } }, { image_uris: { normal: "back.jpg" } }],
      }),
    );
    expect(dfc.image).toBe("front.jpg");
    expect(dfc.typeLine).toBe("Creature — Werewolf");
  });

  it("parses collector numbers", () => {
    expect(collectorNumber("123")).toBe(123);
    expect(collectorNumber("45a")).toBe(45);
    expect(Number.isNaN(collectorNumber("★"))).toBe(true);
  });
});

const RULES: RulesConfig = {
  sheets: {
    common: { label: "Common", rarity: ["common"], treatment: ["normal"], basicLand: false },
    rareMythic: { label: "Rare/mythic", rarity: ["rare", "mythic"], treatment: ["normal"], weights: { rare: 2, mythic: 1 } },
    fun: { label: "Borderless", treatment: ["borderless"] },
    guest: { label: "Special Guest", set: "spg", cn: [[10, 12]] },
  },
  slots: [
    { label: "Common", count: 2, outcomes: [{ sheet: "common", p: 1 }] },
    {
      label: "Rare",
      count: 1,
      outcomes: [
        { sheet: "rareMythic", p: 0.9 },
        { sheet: "fun", p: 0.1, foil: true },
      ],
    },
    {
      label: "Guest",
      count: 1,
      outcomes: [
        { sheet: "common", p: 0.5 },
        { sheet: "guest", p: 0.5 },
      ],
    },
  ],
  sources: [],
};

describe("buildModelFromRules", () => {
  const cards = [
    card({ usd: 0.1 }),
    card({ usd: 0.2 }),
    card({ rarity: "rare", usd: 3 }),
    card({ rarity: "rare", usd: 5 }),
    card({ rarity: "mythic", usd: 20 }),
    card({ rarity: "mythic", treatment: "borderless", usd: 30, usdFoil: 60 }),
    card({ set: "spg", cn: "11", usd: 25 }),
    card({ set: "spg", cn: "40", usd: 99 }),
  ];

  it("weights rares twice as often as mythics", () => {
    const { model } = buildModelFromRules(RULES, cards, "tst");
    const rare = model.sheets.slot2.entries;
    const w = (i: number) => rare.find((e) => e[0] === i)![1];
    expect(w(2)).toBeCloseTo(0.9 * 0.4);
    expect(w(4)).toBeCloseTo(0.9 * 0.2);
    expect(rare.find((e) => e[0] === 5)).toEqual([5, 0.1, 1]);
  });

  it("filters shared sets by collector number", () => {
    const { model } = buildModelFromRules(RULES, cards, "tst");
    const guestSlot = model.sheets.slot3.entries.map((e) => e[0]);
    expect(guestSlot).toContain(6);
    expect(guestSlot).not.toContain(7);
  });

  it("yields the EV implied by the slot odds", () => {
    const { model } = buildModelFromRules(RULES, cards, "tst");
    const ev = computeEv({ model, cards, product: { name: "x", packsPerBox: 1, cardsPerPack: 4 } }, { floor: 0, fees: 0 });
    const common = 0.15;
    const rareSlot = 0.9 * (0.4 * 3 + 0.4 * 5 + 0.2 * 20) + 0.1 * 60;
    const guestSlot = 0.5 * common + 0.5 * 25;
    expect(ev.evPack).toBeCloseTo(2 * common + rareSlot + guestSlot);
  });

  it("reports empty sheets", () => {
    const { emptySheets } = buildModelFromRules(RULES, cards.slice(0, 5), "tst");
    expect(emptySheets.sort()).toEqual(["fun", "guest"]);
  });

  it("builds narrow queries for shared sets", () => {
    expect(rulesQueries(RULES, "tst")).toEqual(["e:tst", "e:spg ((cn>=10 cn<=12))"]);
  });
});

describe("MTGJSON", () => {
  it("labels sheets", () => {
    expect(sheetLabel("rareMythic")).toBe("Rare/mythic");
    expect(sheetLabel("borderlessRareMythic")).toBe("Borderless rare/mythic");
    expect(sheetLabel("foil")).toBe("Traditional foil");
    expect(sheetLabel("specialGuest")).toBe("Special guest");
    expect(sheetLabel("dfc")).toBe("Double-faced");
    expect(sheetLabel("theList")).toBe("The List");
    expect(sheetLabel("sfcRareMythicWithShowcase")).toBe("Single-faced rare/mythic with showcase");
    expect(sheetLabel("rmExtended")).toBe("Rare/mythic extended");
    expect(sheetLabel("foilRetroCu")).toBe("Foil retro common/uncommon");
    expect(sheetLabel("commonUncommonShowcase")).toBe("Common/uncommon showcase");
  });

  it("maps uuids to Scryfall ids and keeps weights", () => {
    const uuids = new Map([
      ["u1", "s1"],
      ["u2", "s2"],
    ]);
    const { model, scryfallIds, missing } = buildModelFromMtgjson(
      {
        boosters: [{ contents: { common: 1, foil: 1 }, weight: 1 }],
        sheets: {
          common: { cards: { u1: 3, u2: 1, u9: 1 }, foil: false },
          foil: { cards: { u2: 1 }, foil: true },
        },
      },
      uuids,
    );
    expect(scryfallIds).toEqual(["s1", "s2"]);
    expect(missing).toEqual(["u9"]);
    expect(model.sheets.common.entries).toEqual([
      [0, 3, 0],
      [1, 1, 0],
    ]);
    expect(model.sheets.foil.entries).toEqual([[1, 1, 1]]);
  });

  it("finds each booster type, including older files' default draft booster", () => {
    const config: MtgjsonBoosterConfig = { boosters: [], sheets: {} };
    const set = { code: "THB", name: "Theros", cards: [], booster: { default: config, collector: config, arena: config } };
    expect(boosterConfig(set, "draft")?.name).toBe("default");
    expect(boosterConfig(set, "collector")?.name).toBe("collector");
    expect(boosterConfig(set, "set")).toBeNull();
    expect(boosterConfig(set, "play")).toBeNull();
  });
});

describe("TCGCSV matching", () => {
  it("finds the main group by code", () => {
    const g = findGroup(
      [
        { groupId: 1, name: "Reality Fracture Commander", abbreviation: "FRC" },
        { groupId: 2, name: "Reality Fracture", abbreviation: "FRA" },
        { groupId: 3, name: "Reality Fracture: Promos", abbreviation: "FRA", isSupplemental: true },
      ],
      "fra",
      "Reality Fracture",
    );
    expect(g?.groupId).toBe(2);
  });

  it("picks each booster's display over cases, bundles and other boosters", () => {
    const products = [
      { productId: 1, name: "Reality Fracture Play Booster Display Case" },
      { productId: 2, name: "Reality Fracture Collector Booster Display" },
      { productId: 3, name: "Reality Fracture Play Booster Pack" },
      { productId: 4, name: "Reality Fracture Play Booster Display" },
      { productId: 5, name: "Reality Fracture Bundle" },
      { productId: 6, name: "Reality Fracture Collector Booster Display Case" },
    ];
    expect(findBoxProduct(products, "play")?.productId).toBe(4);
    expect(findBoxProduct(products, "collector")?.productId).toBe(2);
    expect(findBoxProduct(products, "set")).toBeNull();
  });

  it("prefers the plain display to special editions and variants", () => {
    const products = [
      { productId: 1, name: "The Lord of the Rings: Tales of Middle-earth - Special Edition Collector Booster Display" },
      { productId: 2, name: "The Lord of the Rings: Tales of Middle-earth - Collector Booster Display" },
      { productId: 3, name: "The Lord of the Rings: Tales of Middle-earth - Set Booster Display" },
      { productId: 4, name: "The Lord of the Rings: Tales of Middle-earth - Draft Booster Box" },
      { productId: 5, name: "The Lord of the Rings: Tales of Middle-earth - Draft Booster Display (Minimal Packaging)" },
    ];
    expect(findBoxProduct(products, "collector")?.productId).toBe(2);
    expect(findBoxProduct(products, "set")?.productId).toBe(3);
    expect(findBoxProduct(products, "draft")?.productId).toBe(4);
  });
});

// A fake fetch that answers Scryfall routes from in-memory fixtures.
function fakeScryfall(cards: ScryfallCard[]) {
  const calls: string[] = [];
  const fetchImpl = async (url: string, init?: RequestInit) => {
    calls.push(url);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.includes("/sets/")) return json({ object: "set", code: "tst", name: "Test Set", released_at: "2026-01-01", icon_svg_uri: "icon.svg" });
    if (url.includes("/cards/collection")) {
      const ids = (JSON.parse(String(init?.body)).identifiers as { id: string }[]).map((x) => x.id);
      return json({ object: "list", data: cards.filter((c) => ids.includes(c.id)), not_found: [] });
    }
    if (url.includes("/cards/search")) {
      const q = new URL(url).searchParams.get("q") ?? "";
      const set = /e:(\w+)/.exec(q)?.[1];
      const data = cards.filter((c) => c.set === set);
      if (!data.length) return json({ object: "error", code: "not_found" }, 404);
      return json({ object: "list", data, has_more: false });
    }
    return json({}, 404);
  };
  return { client: createScryfallClient({ fetch: fetchImpl, delayMs: 0 }), calls };
}

const ENTRY: CatalogEntry = {
  code: "tst",
  name: "Test",
  releasedAt: "2026-01-01",
  boosters: [{ type: "play", packsPerBox: 30, estimate: 100, rules: RULES }],
};

function mtgjsonFile(scry: ScryfallCard[], booster: Record<string, MtgjsonBoosterConfig>): MtgjsonSetFile {
  return {
    data: {
      code: "TST",
      name: "Test",
      cards: scry.map((c) => ({ uuid: `u-${c.id}`, name: c.name, number: c.collector_number, setCode: "TST", identifiers: { scryfallId: c.id } })),
      booster,
    },
  };
}

describe("snapshot builders", () => {
  const scry = [
    sf({ id: "c1", collector_number: "1" }),
    sf({ id: "c2", collector_number: "2", prices: { usd: "0.3" } }),
    sf({ id: "r1", collector_number: "3", rarity: "rare", prices: { usd: "4" } }),
    sf({ id: "m1", collector_number: "4", rarity: "mythic", prices: { usd: "22", usd_foil: "40" } }),
    sf({ id: "b1", collector_number: "300", rarity: "mythic", border_color: "borderless", prices: { usd: "35", usd_foil: "70" } }),
    sf({ id: "x1", collector_number: "301", rarity: "rare", frame_effects: ["extendedart"] }),
  ];
  const play: MtgjsonBoosterConfig = {
    name: "Play Booster",
    boosters: [
      { contents: { common: 2, rareMythic: 1 }, weight: 7 },
      { contents: { common: 2, borderless: 1 }, weight: 1 },
    ],
    sheets: {
      common: { cards: { "u-c1": 1, "u-c2": 1 }, foil: false },
      rareMythic: { cards: { "u-r1": 2, "u-m1": 1 }, foil: false },
      borderless: { cards: { "u-b1": 1 }, foil: true },
    },
  };
  const collector: MtgjsonBoosterConfig = {
    name: "Collector Booster",
    boosters: [{ contents: { foilCommon: 1, extended: 1 }, weight: 1 }],
    sheets: {
      foilCommon: { cards: { "u-c1": 1 }, foil: true },
      extended: { cards: { "u-x1": 1 }, foil: false },
    },
  };

  it("builds from rules and drops cards no slot can produce", async () => {
    const { client } = fakeScryfall(scry);
    const snap = await buildSetSnapshot(ENTRY, { client });
    expect(snap.version).toBe(2);
    expect(snap.name).toBe("Test Set");
    expect(snap.cards.map((c) => c.id).sort()).toEqual(["b1", "c1", "c2", "m1", "r1"]);
    expect(snap.boosters.map((b) => b.type)).toEqual(["play"]);
    expect(snap.boosters[0].cardsPerPack).toBe(4);
    expect(snap.boosters[0].boxPrice).toEqual({ usd: 100, source: "estimate" });
    expect(snap.boosters[0].notes.some((n) => n.includes("Special Guest"))).toBe(true);
    const [summary] = summarise(snap).boosters;
    expect(summary.evBox).toBeGreaterThan(0);
    expect(summary.ratio).toBeCloseTo(100 / summary.evBox, 2);
    expect(summary.topCard?.name).toBe("b1");
  });

  it("builds from MTGJSON sheets", async () => {
    const { client } = fakeScryfall(scry);
    const file = mtgjsonFile(scry, { play });
    const snap = await buildSetSnapshot({ ...ENTRY, boosters: [{ type: "play", packsPerBox: 30 }] }, { client, mtgjson: async () => file });
    const booster = snap.boosters[0];
    expect(booster.modelSource).toEqual({ kind: "mtgjson", boosterName: "play" });
    expect(booster.cardsPerPack).toBe(3);
    const ev = computeEv(boosterView(snap, booster), { floor: 0, fees: 0 });
    const perPack = 2 * 0.2 + (7 / 8) * ((2 / 3) * 4 + (1 / 3) * 22) + (1 / 8) * 70;
    expect(ev.evPack).toBeCloseTo(perPack);
  });

  it("gives every booster one shared card pool, looked up once", async () => {
    const { client, calls } = fakeScryfall(scry);
    const file = mtgjsonFile(scry, { play, collector });
    const entry: CatalogEntry = {
      ...ENTRY,
      boosters: [
        { type: "play", packsPerBox: 30 },
        { type: "collector", packsPerBox: 12 },
      ],
    };
    const snap = await buildSetSnapshot(entry, { client, mtgjson: async () => file });
    expect(snap.boosters.map((b) => [b.type, b.name, b.packsPerBox])).toEqual([
      ["play", "Play Booster", 30],
      ["collector", "Collector Booster", 12],
    ]);
    expect(new Set(snap.cards.map((c) => c.id)).size).toBe(snap.cards.length);
    const c1 = snap.cards.findIndex((c) => c.id === "c1");
    expect(snap.boosters[0].model.sheets.common.entries[0][0]).toBe(c1);
    expect(snap.boosters[1].model.sheets.foilCommon.entries).toEqual([[c1, 1, 1]]);
    expect(calls.filter((u) => u.includes("/cards/collection"))).toHaveLength(1);

    const collectorEv = computeEv(boosterView(snap, snap.boosters[1]), { floor: 0, fees: 0 });
    expect(collectorEv.evPack).toBeCloseTo(0.25 + 0.1);
    expect(collectorEv.evBox).toBeCloseTo(12 * 0.35);
    expect(summarise(snap).boosters.map((b) => b.type)).toEqual(["play", "collector"]);
  });

  it("fills in a booster MTGJSON lacks from rules, and notes one nobody models", async () => {
    const { client } = fakeScryfall(scry);
    const file = mtgjsonFile(scry, { collector });
    const entry: CatalogEntry = {
      ...ENTRY,
      boosters: [
        { type: "play", packsPerBox: 30, rules: RULES },
        { type: "set", packsPerBox: 30 },
        { type: "collector", packsPerBox: 12 },
      ],
    };
    const snap = await buildSetSnapshot(entry, { client, mtgjson: async () => file });
    expect(snap.boosters.map((b) => [b.type, b.modelSource.kind])).toEqual([
      ["play", "rules"],
      ["collector", "mtgjson"],
    ]);
    expect(snap.cards.filter((c) => c.id === "c1")).toHaveLength(1);
    expect(snap.notes.some((n) => n.startsWith("Set Boosters aren't priced yet"))).toBe(true);
  });
});

describe("relabel", () => {
  it("renames treatments for cards a sheet matches", () => {
    const rules: RulesConfig = {
      sheets: { mirror: { label: "Mirror", cn: [[10, 20]], relabel: "Shattered Mirror" } },
      slots: [{ label: "Rare", count: 1, outcomes: [{ sheet: "mirror", p: 1 }] }],
      sources: [],
    };
    const cards = [card({ cn: "12", treatment: "borderless", treatmentLabel: "Borderless" }), card({ cn: "30" })];
    const { cards: out } = buildModelFromRules(rules, cards, "tst");
    expect(out[0].treatmentLabel).toBe("Shattered Mirror");
    expect(out[1].treatmentLabel).toBe("Regular");
    expect(cards[0].treatmentLabel).toBe("Borderless");
  });
});

describe("price refresh", () => {
  it("builds whole-set and collector-number searches", async () => {
    const { searchQueriesFor } = await import("../src/lib/data/build");
    expect(searchQueriesFor("fra", Array.from({ length: 200 }, (_, i) => String(i)))).toEqual(["e:fra"]);
    expect(searchQueriesFor("spg", ["159", "160a", "★"])).toEqual(['e:spg (cn:159 or cn:160a or cn:"★")']);
    expect(searchQueriesFor("spg", Array.from({ length: 50 }, (_, i) => String(i)), 40)).toHaveLength(2);
  });

  it("updates prices through GET searches only", async () => {
    const { refreshPricesViaSearch } = await import("../src/lib/data/build");
    const scry = [
      sf({ id: "c1", collector_number: "1" }),
      sf({ id: "r1", collector_number: "3", rarity: "rare", prices: { usd: "4" } }),
      sf({ id: "b1", collector_number: "300", rarity: "mythic", border_color: "borderless", prices: { usd: "35" } }),
    ];
    const { client, calls } = fakeScryfall(scry);
    const snap = await buildSetSnapshot(ENTRY, { client });
    const before = snap.cards.find((c) => c.id === "r1")!.prices.usd;
    scry[1].prices = { usd: "9.5" };
    calls.length = 0;
    const next = await refreshPricesViaSearch(snap, client);
    expect(before).toBe(4);
    expect(next.cards.find((c) => c.id === "r1")!.prices.usd).toBe(9.5);
    expect(calls.every((u) => u.includes("/cards/search"))).toBe(true);
  });
});
