import { describe, expect, it } from "vitest";
import { boosterOfKind, boosterView, upgradeIndex, upgradeSnapshot } from "../src/lib/boosters";
import type { SetSnapshot } from "../src/lib/types";
import { card } from "./helpers";

const model = { variants: [{ weight: 1, contents: { a: 1 } }], sheets: { a: { label: "A", entries: [[0, 1, 0] as [number, number, 0]] } } };

const v1 = {
  version: 1 as const,
  code: "blb",
  name: "Bloomburrow",
  releasedAt: "2024-08-02",
  iconSvg: null,
  product: { name: "Play Booster", packsPerBox: 36, cardsPerPack: 14 },
  boxPrice: { usd: 203.69, source: "tcgplayer" as const },
  sealed: [
    { productId: 1, name: "Bloomburrow - Bundle", kind: "Bundle" as const, market: 50, low: 45, packs: 9, url: "u1", image: null },
    { productId: 2, name: "Bloomburrow - Collector Booster Pack", kind: "Collector Booster Pack" as const, market: 30, low: 28, packs: null, url: "u2", image: null },
  ],
  model,
  modelSource: { kind: "mtgjson" as const, boosterName: "play" },
  cards: [card()],
  generatedAt: "2026-09-01T06:00:00Z",
  sources: [],
  notes: ["A set note."],
};

describe("older snapshot files", () => {
  it("become a set with one Play Booster", () => {
    const set = upgradeSnapshot(v1 as never);
    expect(set.version).toBe(2);
    expect(set.boosters).toHaveLength(1);
    expect(set.boosters[0]).toMatchObject({ type: "play", name: "Play Booster", packsPerBox: 36, boxPrice: { usd: 203.69 } });
    expect(set.cards).toHaveLength(1);
    expect(set.sealed?.map((p) => p.booster)).toEqual(["play", "collector"]);
    expect("product" in set).toBe(false);
  });

  it("upgrade the index the same way", () => {
    const index = upgradeIndex({
      version: 1,
      generatedAt: "2026-09-01T06:00:00Z",
      sets: [
        {
          code: "blb",
          name: "Bloomburrow",
          releasedAt: "2024-08-02",
          iconSvg: null,
          packsPerBox: 36,
          boxPrice: { usd: 203.69, source: "tcgplayer" },
          evBox: 259.4,
          evPack: 7.21,
          ratio: 0.785,
          pricedShare: 1,
          topCard: null,
          modelSource: "mtgjson",
        },
      ],
    });
    expect(index.version).toBe(2);
    expect(index.sets[0].params).toEqual({ floor: 0, fees: 0 });
    expect(index.sets[0].boosters[0]).toMatchObject({ type: "play", evBox: 259.4, ratio: 0.785 });
  });
});

describe("boosterView", () => {
  it("flattens one booster with the set's cards, sealed list and notes", () => {
    const set: SetSnapshot = {
      ...upgradeSnapshot(v1 as never),
      boosters: [
        { type: "play", name: "Play Booster", packsPerBox: 36, cardsPerPack: 14, boxPrice: { usd: 200, source: "tcgplayer" }, model, modelSource: { kind: "mtgjson", boosterName: "play" }, notes: [] },
        {
          type: "collector",
          name: "Collector Booster",
          packsPerBox: 12,
          cardsPerPack: 15,
          boxPrice: { usd: 900, source: "tcgplayer" },
          model,
          modelSource: { kind: "mtgjson", boosterName: "collector" },
          notes: ["A collector note."],
        },
      ],
    };
    const view = boosterView(set, set.boosters[1]);
    expect(view.booster).toBe("collector");
    expect(view.product).toEqual({ name: "Collector Booster", packsPerBox: 12, cardsPerPack: 15 });
    expect(view.boxPrice.usd).toBe(900);
    expect(view.cards).toBe(set.cards);
    expect(view.notes).toEqual(["A set note.", "A collector note."]);
  });

  it("knows which booster a sealed kind holds", () => {
    expect(boosterOfKind("Set Booster Display")).toBe("set");
    expect(boosterOfKind("Sleeved Play Booster")).toBe("play");
    expect(boosterOfKind("Bundle")).toBeNull();
  });
});
