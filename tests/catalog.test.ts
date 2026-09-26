import { describe, expect, it } from "vitest";
import type { BoosterType } from "../src/lib/types";
import { CATALOG } from "../src/sets/catalog";

// Wizards shrank Play Booster displays from 36 to 30 packs with Aetherdrift (2025-02-14).
function displaySize(type: BoosterType, releasedAt: string): number {
  if (type === "play") return releasedAt < "2025-02-14" ? 36 : 30;
  return { draft: 36, set: 30, collector: 12 }[type];
}

describe("catalog", () => {
  it("sizes each display by booster type and era", () => {
    for (const s of CATALOG) {
      for (const b of s.boosters) expect([s.code, b.type, b.packsPerBox]).toEqual([s.code, b.type, displaySize(b.type, s.releasedAt)]);
    }
  });

  it("leads with Play Boosters from Murders at Karlov Manor on, Draft Boosters before", () => {
    for (const s of CATALOG) expect([s.code, s.boosters[0].type]).toEqual([s.code, s.releasedAt >= "2024-02-09" ? "play" : "draft"]);
  });

  it("only lists Set Boosters from Zendikar Rising to The Lost Caverns of Ixalan", () => {
    for (const s of CATALOG) {
      const hasSet = s.boosters.some((b) => b.type === "set");
      expect([s.code, hasSet]).toEqual([s.code, s.releasedAt >= "2020-09-25" && s.releasedAt <= "2023-11-17"]);
    }
  });

  it("lists every booster once, in display order", () => {
    const order: BoosterType[] = ["play", "draft", "set", "collector"];
    for (const s of CATALOG) {
      const types = s.boosters.map((b) => b.type);
      expect([s.code, types]).toEqual([s.code, [...types].sort((a, b) => order.indexOf(a) - order.indexOf(b))]);
      expect(new Set(types).size).toBe(types.length);
    }
  });

  it("is newest first with unique set codes", () => {
    expect(new Set(CATALOG.map((s) => s.code)).size).toBe(CATALOG.length);
    const dates = CATALOG.map((s) => s.releasedAt);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
