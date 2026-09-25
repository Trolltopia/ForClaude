import type { RulesConfig } from "@/lib/data/rules";
import { fraRules } from "./rules/fra";

export interface CatalogEntry {
  code: string;
  name: string;
  releasedAt: string;
  packsPerBox: number;
  /**
   * Fallback box price in USD, used only when TCGplayer has no market price for the
   * Play Booster display. Rough street price, shown in the UI as an estimate.
   */
  boxEstimate: number;
  /** Hand-written collation, for sets MTGJSON hasn't modelled yet. */
  rules?: RulesConfig;
}

// Newest first. Play Booster sets only. Play Booster displays held 36 packs from
// Murders at Karlov Manor (2024) through Foundations; Aetherdrift (2025) cut them to 30.
export const CATALOG: CatalogEntry[] = [
  { code: "fra", name: "Reality Fracture", releasedAt: "2026-10-02", packsPerBox: 30, boxEstimate: 140, rules: fraRules },
  { code: "hob", name: "The Hobbit", releasedAt: "2026-08-14", packsPerBox: 30, boxEstimate: 165 },
  { code: "msh", name: "Marvel Super Heroes", releasedAt: "2026-06-26", packsPerBox: 30, boxEstimate: 165 },
  { code: "sos", name: "Secrets of Strixhaven", releasedAt: "2026-04-24", packsPerBox: 30, boxEstimate: 140 },
  { code: "tmt", name: "Teenage Mutant Ninja Turtles", releasedAt: "2026-03-06", packsPerBox: 30, boxEstimate: 160 },
  { code: "ecl", name: "Lorwyn Eclipsed", releasedAt: "2026-01-23", packsPerBox: 30, boxEstimate: 140 },
  { code: "tla", name: "Avatar: The Last Airbender", releasedAt: "2025-11-21", packsPerBox: 30, boxEstimate: 160 },
  { code: "spm", name: "Marvel's Spider-Man", releasedAt: "2025-09-26", packsPerBox: 30, boxEstimate: 160 },
  { code: "eoe", name: "Edge of Eternities", releasedAt: "2025-08-01", packsPerBox: 30, boxEstimate: 135 },
  { code: "fin", name: "Final Fantasy", releasedAt: "2025-06-13", packsPerBox: 30, boxEstimate: 220 },
  { code: "tdm", name: "Tarkir: Dragonstorm", releasedAt: "2025-04-11", packsPerBox: 30, boxEstimate: 135 },
  { code: "dft", name: "Aetherdrift", releasedAt: "2025-02-14", packsPerBox: 30, boxEstimate: 125 },
  { code: "fdn", name: "Foundations", releasedAt: "2024-11-15", packsPerBox: 36, boxEstimate: 130 },
  { code: "dsk", name: "Duskmourn: House of Horror", releasedAt: "2024-09-27", packsPerBox: 36, boxEstimate: 125 },
  { code: "blb", name: "Bloomburrow", releasedAt: "2024-08-02", packsPerBox: 36, boxEstimate: 140 },
];

export function catalogEntry(code: string): CatalogEntry | undefined {
  return CATALOG.find((s) => s.code === code.toLowerCase());
}
