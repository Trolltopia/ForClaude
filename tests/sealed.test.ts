import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS } from "../src/lib/engine/ev";
import { classifySealed, playBoostersIn, sealedFrom, type TcgProduct } from "../src/lib/data/tcgcsv";
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

  it("counts nine boosters only in a plain bundle", () => {
    expect(playBoostersIn("Bundle", 30, "Aetherdrift - Bundle")).toBe(9);
    expect(playBoostersIn("Bundle", 30, "Aetherdrift - Finish Line Bundle")).toBeNull();
    expect(playBoostersIn("Bundle", 30, "Avatar: The Last Airbender - Commander's Bundle")).toBeNull();
    expect(playBoostersIn("Case", 30, "Aetherdrift - Bundle Case")).toBeNull();
  });

  it("skips singles, tokens and art cards", () => {
    expect(classifySealed(P(10, "Emrakul, the Exigent Doom", { extendedData: [{ name: "Rarity", value: "M" }] }))).toBeNull();
    expect(classifySealed(P(11, "Spirit Token"))).toBeNull();
    expect(classifySealed(P(12, "Art Card: Jace Beleren"))).toBeNull();
    expect(classifySealed(P(13, "Lightning Bolt"))).toBeNull();
  });
});

describe("sealedFrom", () => {
  it("prices products, counts boosters and finds the display", () => {
    const products = [
      P(1, "Test Play Booster Display", { url: "https://tcg/1", imageUrl: "https://img/1" }),
      P(2, "Test Play Booster Pack"),
      P(3, "Test - Bundle"),
      P(4, "Test Collector Booster Display"),
      P(5, "Mox Test", { extendedData: [{ name: "Number", value: "1" }] }),
    ];
    const prices = [
      { productId: 1, marketPrice: 140, lowPrice: 129.99, subTypeName: "Normal" },
      { productId: 2, marketPrice: 5.5, lowPrice: 4.99, subTypeName: "Normal" },
      { productId: 3, marketPrice: null, midPrice: 49.99, lowPrice: 44, subTypeName: "Normal" },
      { productId: 4, marketPrice: 320, lowPrice: 300, subTypeName: "Normal" },
      { productId: 5, marketPrice: 99, subTypeName: "Normal" },
    ];
    const { box, products: sealed } = sealedFrom(products, prices, 30);
    expect(box?.usd).toBe(140);
    expect(box?.productUrl).toBe("https://tcg/1");
    expect(sealed.map((s) => s.kind)).toEqual(["Play Booster Display", "Play Booster Pack", "Bundle", "Collector Booster Display"]);
    expect(sealed[0].packs).toBe(30);
    expect(sealed[1].packs).toBe(1);
    expect(sealed[2].market).toBe(49.99);
    expect(sealed[2].packs).toBe(9);
    expect(sealed[3].packs).toBeNull();
    expect(sealed[0].image).toBe("https://img/1");
  });

  it("knows cases hold six displays", () => {
    expect(playBoostersIn("Play Booster Case", 36)).toBe(216);
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
