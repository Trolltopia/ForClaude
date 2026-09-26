import { describe, expect, it } from "vitest";
import { computeEv, expectedSheetCounts, mostValuable, priceOf, realisedValue } from "../src/lib/engine/ev";
import { createAliasSampler, createRng } from "../src/lib/engine/random";
import { bulkOutcomes, compileModel, openBox, simulateBoxValues, summarise } from "../src/lib/engine/simulate";
import type { BoosterModel, CardRecord } from "../src/lib/types";
import { card } from "./helpers";

// Two commons at $0.10 and $0.30, a rare at $10, a mythic at $40 (foil $80).
function tinySet() {
  const cards: CardRecord[] = [
    card({ usd: 0.1 }),
    card({ usd: 0.3 }),
    card({ rarity: "rare", usd: 10 }),
    card({ rarity: "mythic", usd: 40, usdFoil: 80 }),
  ];
  const model: BoosterModel = {
    variants: [
      { weight: 3, contents: { common: 2, rare: 1 } },
      { weight: 1, contents: { common: 2, foil: 1 } },
    ],
    sheets: {
      common: { label: "Common", entries: [[0, 1, 0], [1, 1, 0]] },
      rare: { label: "Rare/mythic", entries: [[2, 2, 0], [3, 1, 0]] },
      foil: { label: "Foil", entries: [[3, 1, 1]] },
    },
  };
  return { cards, model, product: { name: "Test", packsPerBox: 10, cardsPerPack: 3 } };
}

describe("expectedSheetCounts", () => {
  it("weights each variant's contents", () => {
    const counts = expectedSheetCounts(tinySet().model);
    expect(counts.common).toBeCloseTo(2);
    expect(counts.rare).toBeCloseTo(0.75);
    expect(counts.foil).toBeCloseTo(0.25);
  });
});

describe("computeEv", () => {
  it("matches a hand-computed expected value", () => {
    const set = tinySet();
    const ev = computeEv(set, { floor: 0, fees: 0 });
    // commons: 2 × 0.20 = 0.40; rare slot: 0.75 × (2/3·10 + 1/3·40) = 15; foil: 0.25 × 80 = 20
    expect(ev.evPack).toBeCloseTo(35.4);
    expect(ev.evBox).toBeCloseTo(354);
    expect(ev.sheets.map((s) => s.key)).toEqual(["foil", "rare", "common"]);
    expect(ev.sheets.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });

  it("applies the bulk floor before fees", () => {
    const set = tinySet();
    const ev = computeEv(set, { floor: 0.25, fees: 0.1 });
    // The $0.10 common drops out; everything else loses 10%.
    const expected = (2 * 0.15 + 15 + 20) * 0.9;
    expect(ev.evPack).toBeCloseTo(expected);
  });

  it("tracks per-card odds across sheets and finishes", () => {
    const ev = computeEv(tinySet(), { floor: 0, fees: 0 });
    const mythic = ev.cards.find((c) => c.index === 3 && !c.foil)!;
    const foilMythic = ev.cards.find((c) => c.index === 3 && c.foil)!;
    expect(mythic.perPack).toBeCloseTo(0.25);
    expect(foilMythic.perPack).toBeCloseTo(0.25);
    expect(foilMythic.evBox).toBeCloseTo(0.25 * 10 * 80);
    expect(foilMythic.chanceInBox).toBeCloseTo(1 - Math.exp(-2.5));
    expect(ev.cards.reduce((s, c) => s + c.evBox, 0)).toBeCloseTo(ev.evBox);
  });

  it("reports unpriced cards as zero value", () => {
    const set = tinySet();
    set.cards[2] = { ...set.cards[2], prices: { ...set.cards[2].prices, usd: null } };
    const ev = computeEv(set, { floor: 0, fees: 0 });
    expect(ev.pricedShare).toBeLessThan(1);
    expect(ev.evPack).toBeCloseTo(0.4 + 0.75 * (40 / 3) + 20);
  });
});

describe("priceOf", () => {
  it("uses the foil column for foil-only printings in a nonfoil slot", () => {
    const foilOnly = card({ usd: null, usdFoil: 12, finishes: ["foil"] });
    expect(priceOf(foilOnly, false)).toBe(12);
    const normal = card({ usd: null, usdFoil: 12 });
    expect(priceOf(normal, false)).toBeNull();
  });

  it("falls back to etched for foil slots", () => {
    const etched = card({ usd: 2, usdFoil: null, finishes: ["nonfoil", "etched"] });
    etched.prices.usdEtched = 5;
    expect(priceOf(etched, true)).toBe(5);
  });

  it("realisedValue zeroes cards under the floor", () => {
    expect(realisedValue(0.49, { floor: 0.5, fees: 0 })).toBe(0);
    expect(realisedValue(10, { floor: 0.5, fees: 0.15 })).toBeCloseTo(8.5);
    expect(realisedValue(null, { floor: 0, fees: 0 })).toBe(0);
  });
});

describe("mostValuable", () => {
  it("finds the priciest card in any finish", () => {
    const top = mostValuable(tinySet())!;
    expect(top.price).toBe(80);
    expect(top.foil).toBe(true);
  });
});

describe("random", () => {
  it("is deterministic per seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const xs = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(xs);
    expect(c()).not.toEqual(xs[0]);
    for (const x of xs) expect(x).toBeGreaterThanOrEqual(0);
  });

  it("alias sampler reproduces the weights", () => {
    const weights = [1, 2, 7, 0, 10];
    const pick = createAliasSampler(weights);
    const rng = createRng(7);
    const hits = new Array(weights.length).fill(0);
    const N = 200_000;
    for (let i = 0; i < N; i++) hits[pick(rng())]++;
    const total = weights.reduce((s, w) => s + w, 0);
    weights.forEach((w, i) => expect(hits[i] / N).toBeCloseTo(w / total, 2));
  });
});

describe("simulation", () => {
  it("averages out to the analytic EV", () => {
    const set = tinySet();
    const params = { floor: 0, fees: 0 };
    const compiled = compileModel(set.model, set.cards, params);
    const values = simulateBoxValues(compiled, 10, 40_000, 1);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const ev = computeEv(set, params).evBox;
    expect(Math.abs(mean - ev) / ev).toBeLessThan(0.01);
  });

  it("opens a box pack by pack", () => {
    const set = tinySet();
    const compiled = compileModel(set.model, set.cards, { floor: 0, fees: 0 });
    const box = openBox(compiled, 10, 3);
    expect(box.packs).toHaveLength(10);
    for (const pack of box.packs) expect(pack).toHaveLength(3);
    const total = box.packs.flat().reduce((s, p) => s + p.value, 0);
    expect(box.total).toBeCloseTo(total);
  });

  it("summarises percentiles and histogram", () => {
    const values = Float64Array.from({ length: 1000 }, (_, i) => i);
    const s = summarise(values, 500);
    expect(s.percentiles.p50).toBeCloseTo(499.5);
    expect(s.beatPrice).toBeCloseTo(0.5);
    expect(s.doublePrice).toBe(0);
    expect(s.bins.reduce((a, b) => a + b.count, 0)).toBe(1000);
    expect(s.bins[0].from).toBeLessThanOrEqual(0);
    expect(s.bulk.map((b) => b.boxes)).toEqual([1, 3, 10, 30, 100]);
  });
});

describe("chance wording", () => {
  it("never rounds a simulated share to always or never", async () => {
    const { chance } = await import("../src/lib/format");
    expect(chance(0)).toBe("under 0.1%");
    expect(chance(0.0004)).toBe("under 0.1%");
    expect(chance(0.004)).toBe("0.4%");
    expect(chance(0.45)).toBe("45%");
    expect(chance(0.995)).toBe("99.5%");
    expect(chance(0.9999)).toBe("over 99.9%");
    expect(chance(1)).toBe("over 99.9%");
    expect(chance(null)).toBe("—");
  });
});

describe("runs of several boxes", () => {
  // A coin-flip box: worth $0 or $100. Its average is $50 and its standard deviation $50,
  // so the average of 100 boxes has a standard deviation of $5.
  const coin = Float64Array.from({ length: 10_000 }, (_, i) => (i % 2 ? 100 : 0));

  it("narrows toward the expected value as the run grows", () => {
    const [one, three, ten, thirty, hundred] = bulkOutcomes(coin, 60);
    expect([one.p5, one.p95]).toEqual([0, 100]);
    // The middle half of runs; the outer tails of a coin flip stay at $0 and $100 for a few boxes.
    const width = (b: typeof one) => b.p75 - b.p25;
    expect(width(three)).toBeLessThan(width(one));
    expect(width(ten)).toBeLessThan(width(three));
    expect(width(thirty)).toBeLessThan(width(ten));
    expect(width(hundred)).toBeLessThan(width(thirty));
    // 1.645 standard deviations either side of $50.
    expect(hundred.p5).toBeGreaterThan(50 - 1.645 * 5 - 1.5);
    expect(hundred.p5).toBeLessThan(50 - 1.645 * 5 + 1.5);
    expect(hundred.p95).toBeGreaterThan(50 + 1.645 * 5 - 1.5);
    expect(hundred.p95).toBeLessThan(50 + 1.645 * 5 + 1.5);
    expect(hundred.p50).toBeCloseTo(50, 0);
  });

  it("gives the chance a run pays for itself", () => {
    const [one, , , , hundred] = bulkOutcomes(coin, 60);
    expect(one.beatPrice).toBeCloseTo(0.5);
    // Two standard deviations above the average: about 2.3% of runs.
    expect(hundred.beatPrice!).toBeGreaterThan(0.01);
    expect(hundred.beatPrice!).toBeLessThan(0.04);
    expect(bulkOutcomes(coin, null)[0].beatPrice).toBeNull();
  });

  it("is repeatable", () => {
    expect(bulkOutcomes(coin, 60)).toEqual(bulkOutcomes(coin, 60));
  });
});

describe("verdict", () => {
  it("calls crack, toss-up and keep on the return, and holds off before release", async () => {
    const { verdictFor } = await import("../src/lib/verdict");
    expect(verdictFor(0.25, "2020-01-01")).toBe("crack");
    expect(verdictFor(0.05, "2020-01-01")).toBe("crack");
    expect(verdictFor(0.02, "2020-01-01")).toBe("toss-up");
    expect(verdictFor(-0.04, "2020-01-01")).toBe("toss-up");
    expect(verdictFor(-0.05, "2020-01-01")).toBe("keep");
    expect(verdictFor(-0.3, "2020-01-01")).toBe("keep");
    expect(verdictFor(0.8, "2999-01-01")).toBe("early");
    expect(verdictFor(null)).toBeNull();
  });

  it("measures the return on the price and writes it with a sign", async () => {
    const { returnOf } = await import("../src/lib/verdict");
    const { signedPercent } = await import("../src/lib/format");
    expect(returnOf(100, 135)).toBeCloseTo(0.35);
    expect(returnOf(100, 88)).toBeCloseTo(-0.12);
    expect(returnOf(null, 88)).toBeNull();
    expect(returnOf(100, 0)).toBeNull();
    expect(signedPercent(0.35)).toBe("+35%");
    expect(signedPercent(-0.12)).toBe("−12%");
    expect(signedPercent(0.004)).toBe("0%");
    expect(signedPercent(2.45)).toBe("+245%");
  });
});
