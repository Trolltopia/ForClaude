import { describe, expect, it } from "vitest";
import type { BoosterType } from "../src/lib/types";
import { CATALOG, catalogEntry } from "../src/sets/catalog";

const premier = CATALOG.filter((s) => s.setType === "expansion" || s.setType === "core");

describe("catalog", () => {
  it("goes back to Limited Edition Alpha", () => {
    expect(CATALOG.at(-1)?.code).toBe("lea");
    expect(CATALOG.length).toBeGreaterThan(150);
  });

  it("sizes Play Booster displays at 36 packs until Aetherdrift and 30 after", () => {
    for (const s of CATALOG) {
      for (const b of s.boosters.filter((x) => x.type === "play")) {
        expect([s.code, b.packsPerBox]).toEqual([s.code, s.releasedAt < "2025-02-14" ? 36 : 30]);
      }
    }
  });

  it("only uses display sizes Wizards has printed", () => {
    const sizes: Record<BoosterType, number[]> = { play: [30, 36], draft: [24, 36, 45, 60], set: [18, 24, 30], collector: [4, 12] };
    for (const s of CATALOG) for (const b of s.boosters) expect([s.code, b.type, sizes[b.type].includes(b.packsPerBox)]).toEqual([s.code, b.type, true]);
  });

  it("matches the display sizes of the odd ones out", () => {
    const size = (code: string, type: BoosterType) => catalogEntry(code)?.boosters.find((b) => b.type === type)?.packsPerBox;
    expect(size("arn", "draft")).toBe(60);
    expect(size("all", "draft")).toBe(45);
    expect(size("uma", "draft")).toBe(24);
    expect(size("cmm", "collector")).toBe(4);
    expect(size("clb", "set")).toBe(18);
    // Every premier set since Mirage came in 36-pack boxes.
    for (const s of premier.filter((x) => x.releasedAt >= "1996-10-08")) {
      const d = s.boosters.find((b) => b.type === "draft");
      if (d) expect([s.code, d.packsPerBox]).toEqual([s.code, 36]);
    }
  });

  it("leads premier sets with Play Boosters from Murders at Karlov Manor on, Draft Boosters before", () => {
    for (const s of premier) expect([s.code, s.boosters[0].type]).toEqual([s.code, s.releasedAt >= "2024-02-09" ? "play" : "draft"]);
  });

  it("only lists Set Boosters from Zendikar Rising to The Lost Caverns of Ixalan", () => {
    for (const s of CATALOG) {
      const hasSet = s.boosters.some((b) => b.type === "set");
      if (hasSet) expect([s.code, s.releasedAt >= "2020-09-25" && s.releasedAt <= "2023-11-17"]).toEqual([s.code, true]);
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
