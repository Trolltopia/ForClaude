import type { RulesConfig } from "@/lib/data/rules";
import type { BoosterType } from "@/lib/types";
import { fraRules } from "./rules/fra";

export interface BoosterSpec {
  type: BoosterType;
  /** Packs in a sealed display. */
  packsPerBox: number;
  /**
   * Fallback display price in USD, used only when TCGplayer has no market price for it.
   * Rough street price, shown in the UI as an estimate.
   */
  estimate?: number;
  /** Hand-written collation, for when MTGJSON hasn't modelled this booster yet. */
  rules?: RulesConfig;
}

export interface CatalogEntry {
  code: string;
  name: string;
  releasedAt: string;
  /** Booster products to price, main one first. */
  boosters: BoosterSpec[];
}

// Display sizes. Play Booster displays held 36 packs from Murders at Karlov Manor (2024)
// through Foundations; Aetherdrift (2025) cut them to 30. Draft Booster displays held 36,
// Set Booster displays 30, Collector Booster displays 12.
const play30 = (estimate: number, rules?: RulesConfig): BoosterSpec => ({ type: "play", packsPerBox: 30, estimate, rules });
const play36 = (estimate?: number): BoosterSpec => ({ type: "play", packsPerBox: 36, estimate });
const draft: BoosterSpec = { type: "draft", packsPerBox: 36 };
const setBooster: BoosterSpec = { type: "set", packsPerBox: 30 };
const collector: BoosterSpec = { type: "collector", packsPerBox: 12 };

// Newest first: premier sets, Modern Horizons and The Lord of the Rings since 2020.
export const CATALOG: CatalogEntry[] = [
  { code: "fra", name: "Reality Fracture", releasedAt: "2026-10-02", boosters: [play30(140, fraRules), collector] },
  { code: "hob", name: "The Hobbit", releasedAt: "2026-08-14", boosters: [play30(165), collector] },
  { code: "msh", name: "Marvel Super Heroes", releasedAt: "2026-06-26", boosters: [play30(165), collector] },
  { code: "sos", name: "Secrets of Strixhaven", releasedAt: "2026-04-24", boosters: [play30(140), collector] },
  { code: "tmt", name: "Teenage Mutant Ninja Turtles", releasedAt: "2026-03-06", boosters: [play30(160), collector] },
  { code: "ecl", name: "Lorwyn Eclipsed", releasedAt: "2026-01-23", boosters: [play30(140), collector] },
  { code: "tla", name: "Avatar: The Last Airbender", releasedAt: "2025-11-21", boosters: [play30(160), collector] },
  { code: "spm", name: "Marvel's Spider-Man", releasedAt: "2025-09-26", boosters: [play30(160), collector] },
  { code: "eoe", name: "Edge of Eternities", releasedAt: "2025-08-01", boosters: [play30(135), collector] },
  { code: "fin", name: "Final Fantasy", releasedAt: "2025-06-13", boosters: [play30(220), collector] },
  { code: "tdm", name: "Tarkir: Dragonstorm", releasedAt: "2025-04-11", boosters: [play30(135), collector] },
  { code: "dft", name: "Aetherdrift", releasedAt: "2025-02-14", boosters: [play30(125), collector] },
  { code: "fdn", name: "Foundations", releasedAt: "2024-11-15", boosters: [play36(130), collector] },
  { code: "dsk", name: "Duskmourn: House of Horror", releasedAt: "2024-09-27", boosters: [play36(125), collector] },
  { code: "blb", name: "Bloomburrow", releasedAt: "2024-08-02", boosters: [play36(140), collector] },
  { code: "mh3", name: "Modern Horizons 3", releasedAt: "2024-06-14", boosters: [play36(), collector] },
  { code: "otj", name: "Outlaws of Thunder Junction", releasedAt: "2024-04-19", boosters: [play36(), collector] },
  { code: "mkm", name: "Murders at Karlov Manor", releasedAt: "2024-02-09", boosters: [play36(), collector] },
  { code: "lci", name: "The Lost Caverns of Ixalan", releasedAt: "2023-11-17", boosters: [draft, setBooster, collector] },
  { code: "woe", name: "Wilds of Eldraine", releasedAt: "2023-09-08", boosters: [draft, setBooster, collector] },
  { code: "ltr", name: "The Lord of the Rings: Tales of Middle-earth", releasedAt: "2023-06-23", boosters: [draft, setBooster, collector] },
  { code: "mom", name: "March of the Machine", releasedAt: "2023-04-21", boosters: [draft, setBooster, collector] },
  { code: "one", name: "Phyrexia: All Will Be One", releasedAt: "2023-02-10", boosters: [draft, setBooster, collector] },
  { code: "bro", name: "The Brothers' War", releasedAt: "2022-11-18", boosters: [draft, setBooster, collector] },
  { code: "dmu", name: "Dominaria United", releasedAt: "2022-09-09", boosters: [draft, setBooster, collector] },
  { code: "snc", name: "Streets of New Capenna", releasedAt: "2022-04-29", boosters: [draft, setBooster, collector] },
  { code: "neo", name: "Kamigawa: Neon Dynasty", releasedAt: "2022-02-18", boosters: [draft, setBooster, collector] },
  { code: "vow", name: "Innistrad: Crimson Vow", releasedAt: "2021-11-19", boosters: [draft, setBooster, collector] },
  { code: "mid", name: "Innistrad: Midnight Hunt", releasedAt: "2021-09-24", boosters: [draft, setBooster, collector] },
  { code: "afr", name: "Adventures in the Forgotten Realms", releasedAt: "2021-07-23", boosters: [draft, setBooster, collector] },
  { code: "mh2", name: "Modern Horizons 2", releasedAt: "2021-06-18", boosters: [draft, setBooster, collector] },
  { code: "stx", name: "Strixhaven: School of Mages", releasedAt: "2021-04-23", boosters: [draft, setBooster, collector] },
  { code: "khm", name: "Kaldheim", releasedAt: "2021-02-05", boosters: [draft, setBooster, collector] },
  { code: "znr", name: "Zendikar Rising", releasedAt: "2020-09-25", boosters: [draft, setBooster, collector] },
  // Before Zendikar Rising there were no Set Boosters.
  { code: "m21", name: "Core Set 2021", releasedAt: "2020-07-03", boosters: [draft, collector] },
  { code: "iko", name: "Ikoria: Lair of Behemoths", releasedAt: "2020-04-24", boosters: [draft, collector] },
  { code: "thb", name: "Theros Beyond Death", releasedAt: "2020-01-24", boosters: [draft, collector] },
];

export function catalogEntry(code: string): CatalogEntry | undefined {
  return CATALOG.find((s) => s.code === code.toLowerCase());
}

export function boosterSpec(entry: CatalogEntry, type: BoosterType): BoosterSpec | undefined {
  return entry.boosters.find((b) => b.type === type);
}
