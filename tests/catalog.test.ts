import { describe, expect, it } from "vitest";
import { CATALOG } from "../src/sets/catalog";

describe("catalog", () => {
  it("uses 36-pack displays before Aetherdrift and 30 from then on", () => {
    // Wizards shrank Play Booster displays from 36 to 30 packs with Aetherdrift (2025-02-14).
    for (const s of CATALOG) expect([s.code, s.packsPerBox]).toEqual([s.code, s.releasedAt < "2025-02-14" ? 36 : 30]);
  });

  it("has unique set codes", () => {
    expect(new Set(CATALOG.map((s) => s.code)).size).toBe(CATALOG.length);
  });
});
