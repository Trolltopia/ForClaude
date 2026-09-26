import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../src/lib/engine/ev";
import {
  boostersIn,
  classifySealed,
  fetchSealed,
  findCompanionGroups,
  sealedFrom,
  type TcgGroup,
  type TcgProduct,
} from "../src/lib/data/tcgcsv";
import { settingsPhrase } from "../src/lib/verdict";

const P = (productId: number, name: string, extra: Partial<TcgProduct> = {}): TcgProduct => ({ productId, name, ...extra });

describe("classifySealed", () => {
  it("sorts TCGplayer listings into sealed kinds", () => {
    expect(classifySealed(P(1, "Reality Fracture Play Booster Display"))).toBe("Play Booster Display");
    expect(classifySealed(P(2, "Reality Fracture Play Booster Pack"))).toBe("Play Booster Pack");
    expect(classifySealed(P(3, "Reality Fracture Play Booster Display Case"))).toBe("Play Booster Case");
    expect(classifySealed(P(4, "Reality Fracture Collector Booster Display"))).toBe("Collector Booster Display");
    expect(classifySealed(P(5, "Reality Fracture Collector Booster Pack"))).toBe("Collector Booster Pack");
    expect(classifySealed(P(6, "Reality Fracture Bundle"))).toBe("Bundle");
    expect(classifySealed(P(7, "Reality Fracture Gift Bundle"))).toBe("Gift Bundle");
    expect(classifySealed(P(8, "Reality Fracture Prerelease Pack"))).toBe("Prerelease Pack");
    expect(classifySealed(P(9, "Reality Fracture Commander Deck - Mirror Mayhem"))).toBe("Commander Deck");
  });

  it("handles real TCGplayer names: cases, master cases, themed bundles, other languages", () => {
    const kind = (name: string) => classifySealed(P(0, name));
    expect(kind("Aetherdrift - Bundle Case")).toBe("Case");
    expect(kind("The Hobbit - Prerelease Pack Case")).toBe("Case");
    expect(kind("Marvel Super Heroes Scene Box Case")).toBe("Case");
    expect(kind("Teenage Mutant Ninja Turtles - Collector Booster Display MasterCase")).toBe("Collector Booster Case");
    expect(kind("The Hobbit - Collector Booster Display Master Case")).toBe("Collector Booster Case");
    expect(kind("The Hobbit - Play Booster Display Case")).toBe("Play Booster Case");
    expect(kind("The Hobbit - Sleeved Play Booster Pack")).toBe("Sleeved Play Booster");
    expect(kind("Tarkir: Dragonstorm - Collector Booster (Minimal Packaging)")).toBe("Collector Booster Pack");
    expect(kind("Duskmourn: House of Horror - Nightmare Bundle Booster Pack")).toBe("Other");
    expect(kind("Magic: The Gathering Foundations - Beginner Box")).toBe("Starter Kit");
    expect(kind("Avatar: The Last Airbender - Jumpstart Booster Display")).toBe("Jumpstart");
    expect(kind("FINAL FANTASY - Chocobo Bundle (Japanese)")).toBeNull();
    expect(kind("FINAL FANTASY - Basic Booster Display (Japanese)")).toBeNull();
    expect(kind("Secrets of Strixhaven - Fujichoco x Wandering Emperor Promo Pack (JP)")).toBeNull();
  });

  it("counts nine boosters only in a plain Play Booster bundle", () => {
    const play = { play: 30, collector: 12 };
    expect(boostersIn("Bundle", play, "Aetherdrift - Bundle")).toEqual({ booster: "play", packs: 9 });
    expect(boostersIn("Bundle", play, "Aetherdrift - Finish Line Bundle")).toBeNull();
    expect(boostersIn("Bundle", play, "Avatar: The Last Airbender - Commander's Bundle")).toBeNull();
    expect(boostersIn("Case", play, "Aetherdrift - Bundle Case")).toBeNull();
    // Bundles before Play Boosters held Set or Draft Boosters in varying numbers.
    expect(boostersIn("Bundle", { draft: 36, set: 30, collector: 12 }, "Wilds of Eldraine - Bundle")).toBeNull();
  });

  it("sorts Draft and Set Booster listings", () => {
    const kind = (name: string) => classifySealed(P(0, name));
    expect(kind("Wilds of Eldraine - Draft Booster Display")).toBe("Draft Booster Display");
    expect(kind("Wilds of Eldraine - Draft Booster Pack")).toBe("Draft Booster Pack");
    expect(kind("Wilds of Eldraine - Set Booster Display")).toBe("Set Booster Display");
    expect(kind("Wilds of Eldraine - Set Booster Pack")).toBe("Set Booster Pack");
    expect(kind("Wilds of Eldraine - Set Booster Display Case")).toBe("Set Booster Case");
    expect(kind("Wilds of Eldraine - Collector Booster Display")).toBe("Collector Booster Display");
    expect(kind("Kaldheim - Collector Booster Sample Pack")).toBe("Other");
    expect(kind("Zendikar Rising - Theme Booster")).toBe("Other");
    expect(kind("Wilds of Eldraine - Bundle")).toBe("Bundle");
  });

  it("reads a plain booster box as Draft Boosters before Set Boosters existed", () => {
    const opts = { plainBooster: "draft" as const };
    expect(classifySealed(P(0, "Theros Beyond Death - Booster Box"), opts)).toBe("Draft Booster Display");
    expect(classifySealed(P(0, "Theros Beyond Death - Booster Pack"), opts)).toBe("Draft Booster Pack");
    expect(classifySealed(P(0, "Theros Beyond Death - Booster Box Case"), opts)).toBe("Draft Booster Case");
    expect(classifySealed(P(0, "Theros Beyond Death - Theme Booster Pack"), opts)).toBe("Other");
    expect(classifySealed(P(0, "Theros Beyond Death - Booster Box"))).toBe("Other");
  });

  it("doesn't count special editions, Omega packs, hanger packs or multipacks as one booster", () => {
    const d = { draft: 36, set: 30, collector: 12 };
    const LTR = "Universes Beyond: The Lord of the Rings: Tales of Middle-earth";
    expect(boostersIn("Collector Booster Pack", d, "Wilds of Eldraine - Collector Booster Omega Pack")).toBeNull();
    expect(boostersIn("Collector Booster Display", d, "The Lord of the Rings: Tales of Middle-earth - Special Edition Collector Booster Display")).toBeNull();
    expect(boostersIn("Collector Booster Pack", d, "Zendikar Rising - Collector Booster Hanger Pack")).toBeNull();
    expect(boostersIn("Draft Booster Pack", d, `${LTR} - Draft Booster Pack (3-Pack)`)).toEqual({ booster: "draft", packs: 3 });
    expect(boostersIn("Set Booster Pack", d, `${LTR} - Sleeved Set Booster Pack`)).toEqual({ booster: "set", packs: 1 });
    expect(boostersIn("Draft Booster Pack", d, "Core Set 2021 - Draft Booster Pack")).toEqual({ booster: "draft", packs: 1 });
    expect(classifySealed(P(0, "Zendikar Rising - Bundle Gift Edition"))).toBe("Gift Bundle");
    expect(classifySealed(P(0, "Theros Beyond Death - Collector Booster Pack Display"))).toBe("Collector Booster Display");
  });

  it("counts boosters in packs, displays and Play Booster cases", () => {
    const d = { draft: 36, set: 30, collector: 12 };
    expect(boostersIn("Set Booster Pack", d)).toEqual({ booster: "set", packs: 1 });
    expect(boostersIn("Set Booster Display", d)).toEqual({ booster: "set", packs: 30 });
    expect(boostersIn("Draft Booster Display", d)).toEqual({ booster: "draft", packs: 36 });
    expect(boostersIn("Collector Booster Display", d)).toEqual({ booster: "collector", packs: 12 });
    expect(boostersIn("Collector Booster Case", d)).toBeNull();
    expect(boostersIn("Play Booster Display", d)).toBeNull();
    expect(boostersIn("Sleeved Play Booster", { play: 30 })).toEqual({ booster: "play", packs: 1 });
  });

  it("skips singles, tokens and art cards", () => {
    expect(classifySealed(P(10, "Emrakul, the Exigent Doom", { extendedData: [{ name: "Rarity", value: "M" }] }))).toBeNull();
    expect(classifySealed(P(11, "Spirit Token"))).toBeNull();
    expect(classifySealed(P(12, "Art Card: Jace Beleren"))).toBeNull();
    expect(classifySealed(P(13, "Lightning Bolt"))).toBeNull();
  });
});

describe("sealedFrom", () => {
  it("prices products, counts boosters and finds each display", () => {
    const products = [
      P(1, "Test Play Booster Display", { url: "https://tcg/1", imageUrl: "https://img/1" }),
      P(2, "Test Play Booster Pack"),
      P(3, "Test - Bundle"),
      P(4, "Test Collector Booster Display", { url: "https://tcg/4" }),
      P(5, "Mox Test", { extendedData: [{ name: "Number", value: "1" }] }),
    ];
    const prices = [
      { productId: 1, marketPrice: 140, lowPrice: 129.99, subTypeName: "Normal" },
      { productId: 2, marketPrice: 5.5, lowPrice: 4.99, subTypeName: "Normal" },
      { productId: 3, marketPrice: null, midPrice: 49.99, lowPrice: 44, subTypeName: "Normal" },
      { productId: 4, marketPrice: 320, lowPrice: 300, subTypeName: "Normal" },
      { productId: 5, marketPrice: 99, subTypeName: "Normal" },
    ];
    const { boxes, products: sealed } = sealedFrom(products, prices, { play: 30, collector: 12 });
    expect(boxes.play?.usd).toBe(140);
    expect(boxes.play?.productUrl).toBe("https://tcg/1");
    expect(boxes.collector?.usd).toBe(320);
    expect(boxes.collector?.productUrl).toBe("https://tcg/4");
    expect(sealed.map((s) => s.kind)).toEqual(["Play Booster Display", "Play Booster Pack", "Collector Booster Display", "Bundle"]);
    expect(sealed.map((s) => [s.booster, s.packs])).toEqual([
      ["play", 30],
      ["play", 1],
      ["collector", 12],
      ["play", 9],
    ]);
    expect(sealed[3].market).toBe(49.99);
    expect(sealed[0].image).toBe("https://img/1");
  });

  it("finds Draft, Set and Collector displays for an older set", () => {
    const products = [P(1, "Kaldheim - Draft Booster Display"), P(2, "Kaldheim - Set Booster Display"), P(3, "Kaldheim - Collector Booster Display")];
    const prices = [
      { productId: 1, marketPrice: 150, subTypeName: "Normal" },
      { productId: 2, marketPrice: 120, subTypeName: "Normal" },
      { productId: 3, marketPrice: 260, subTypeName: "Normal" },
    ];
    const { boxes } = sealedFrom(products, prices, { draft: 36, set: 30, collector: 12 });
    expect([boxes.draft?.usd, boxes.set?.usd, boxes.collector?.usd]).toEqual([150, 120, 260]);
  });

  it("knows Play Booster cases hold six displays", () => {
    expect(boostersIn("Play Booster Case", { play: 36 })).toEqual({ booster: "play", packs: 216 });
  });
});

describe("defaults and wording", () => {
  it("takes 8% selling fees off by default and ignores nothing", () => {
    expect(DEFAULT_PARAMS).toEqual({ floor: 0, fees: 0.08 });
  });

  it("describes the settings in plain words", () => {
    expect(settingsPhrase({ floor: 0, fees: 0.08 })).toBe("after 8% selling fees");
    expect(settingsPhrase({ floor: 0.25, fees: 0.08 })).toBe("ignoring cards under 25¢, after 8% selling fees");
    expect(settingsPhrase({ floor: 2, fees: 0 })).toBe("ignoring cards under $2.00");
    expect(settingsPhrase({ floor: 0, fees: 0 })).toBe("at full market price");
  });
});

describe("Commander companion groups", () => {
  const groups: TcgGroup[] = [
    { groupId: 1, name: "Duskmourn: House of Horror", abbreviation: "DSK", publishedOn: "2024-09-27T00:00:00" },
    { groupId: 2, name: "Commander: Duskmourn", abbreviation: "DSC", publishedOn: "2024-09-27T00:00:00" },
    { groupId: 3, name: "Commander: Bloomburrow", abbreviation: "BLC", publishedOn: "2024-08-02T00:00:00" },
    { groupId: 4, name: "Duskmourn: House of Horror Promos", abbreviation: "PDSK", isSupplemental: true, publishedOn: "2024-09-27T00:00:00" },
    { groupId: 5, name: "Commander: Duskmourn Anniversary", publishedOn: "2029-01-01T00:00:00" },
  ];

  it("pairs a set with its Commander group by name and release date", () => {
    const found = findCompanionGroups(groups, groups[0], "Duskmourn: House of Horror", "2024-09-27");
    expect(found.map((g) => g.groupId)).toEqual([2]);
  });

  it("also pairs a set with its Jumpstart companion", () => {
    const fdn: TcgGroup[] = [
      { groupId: 10, name: "Magic: The Gathering Foundations", abbreviation: "FDN", publishedOn: "2024-11-15T00:00:00" },
      { groupId: 11, name: "Foundations Jumpstart", abbreviation: "J25", publishedOn: "2024-11-15T00:00:00" },
      { groupId: 12, name: "Jumpstart 2022", abbreviation: "J22", publishedOn: "2022-12-02T00:00:00" },
    ];
    expect(findCompanionGroups(fdn, fdn[0], "Foundations", "2024-11-15").map((g) => g.groupId)).toEqual([11]);
    expect(classifySealed(P(1, "Foundations Jumpstart Booster Display"))).toBe("Jumpstart");
  });

  it("files Deluxe Commander Kits with the precons", () => {
    expect(classifySealed(P(1, "Bloomburrow Deluxe Commander Kit - Peace Offering"))).toBe("Commander Deck");
  });

  it("treats any sealed deck in a Commander group as a precon", () => {
    expect(classifySealed(P(1, "Endless Punishment Deck"), { commander: true })).toBe("Commander Deck");
    expect(classifySealed(P(2, "Endless Punishment Deck"))).toBe("Other");
    expect(classifySealed(P(3, "Duskmourn Commander Deck Display [Set of 4]"), { commander: true })).toBe("Commander Deck");
    expect(classifySealed(P(4, "Valgavoth, Terror Eater", { extendedData: [{ name: "Rarity", value: "M" }] }), { commander: true })).toBeNull();
  });

  it("fetches the main set and its precons in one pass", async () => {
    const json = (results: unknown) => new Response(JSON.stringify({ success: true, results }), { status: 200 });
    const fake = async (url: string) => {
      if (url.endsWith("/groups")) return json(groups);
      if (url.endsWith("/1/products")) return json([P(10, "Duskmourn: House of Horror - Play Booster Display")]);
      if (url.endsWith("/1/prices")) return json([{ productId: 10, marketPrice: 198.16, subTypeName: "Normal" }]);
      if (url.endsWith("/2/products"))
        return json([
          P(20, "Commander: Duskmourn - Death Toll Commander Deck"),
          P(21, "Endless Punishment Deck"),
          P(22, "Valgavoth, Terror Eater", { extendedData: [{ name: "Number", value: "1" }] }),
        ]);
      if (url.endsWith("/2/prices"))
        return json([
          { productId: 20, marketPrice: 54.5, subTypeName: "Normal" },
          { productId: 21, marketPrice: 61.25, subTypeName: "Normal" },
          { productId: 22, marketPrice: 12, subTypeName: "Normal" },
        ]);
      return new Response("not found", { status: 404 });
    };
    const { boxes, products } = await fetchSealed(
      { code: "dsk", name: "Duskmourn: House of Horror", releasedAt: "2024-09-27", displays: { play: 36, collector: 12 } },
      fake,
    );
    expect(boxes.play?.usd).toBe(198.16);
    expect(boxes.collector).toBeUndefined();
    const precons = products.filter((p) => p.kind === "Commander Deck");
    expect(precons.map((p) => p.market)).toEqual([61.25, 54.5]);
    expect(products.some((p) => p.name.startsWith("Valgavoth"))).toBe(false);
  });
});
