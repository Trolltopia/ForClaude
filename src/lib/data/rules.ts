import type { BoosterModel, CardRecord, Rarity, Sheet, SheetEntry, Source, Treatment } from "../types";
import { collectorNumber } from "./scryfall";

/**
 * Hand-written collation for a set, transcribed from Wizards' "Collecting <set>"
 * article. Used when MTGJSON has no booster data yet (usually the weeks around
 * release) and for live in-browser builds.
 */
export interface RulesConfig {
  /** Pools of cards. A slot outcome draws uniformly (or by rarity weight) from one pool. */
  sheets: Record<string, RuleSheet>;
  slots: RuleSlot[];
  sources: Source[];
  notes?: string[];
}

export interface RuleSheet {
  label: string;
  /** Scryfall set code; defaults to the set being built. */
  set?: string;
  rarity?: Rarity[];
  /** Inclusive collector number ranges. */
  cn?: [number, number][];
  treatment?: Treatment[];
  /** true keeps only basic lands, false drops them. */
  basicLand?: boolean;
  /** Relative weight of each card by rarity, e.g. rares twice as common as mythics. */
  weights?: Partial<Record<Rarity, number>>;
  /** Treatment name to show for these cards when Scryfall's frame data is too generic. */
  relabel?: string;
}

export interface RuleOutcome {
  sheet: string;
  /** Probability this slot shows a card from `sheet`. Outcomes in a slot sum to 1. */
  p: number;
  foil?: boolean;
}

export interface RuleSlot {
  label: string;
  count: number;
  outcomes: RuleOutcome[];
}

export function matchesSheet(card: CardRecord, sheet: RuleSheet, defaultSet: string): boolean {
  if (card.set !== (sheet.set ?? defaultSet)) return false;
  if (sheet.rarity && !sheet.rarity.includes(card.rarity)) return false;
  if (sheet.treatment && !sheet.treatment.includes(card.treatment)) return false;
  if (sheet.basicLand === true && !card.isBasicLand) return false;
  if (sheet.basicLand === false && card.isBasicLand) return false;
  if (sheet.cn) {
    const n = collectorNumber(card.cn);
    if (!sheet.cn.some(([a, b]) => n >= a && n <= b)) return false;
  }
  return true;
}

export interface RulesBuild {
  model: BoosterModel;
  /** The input cards, with treatment labels from `relabel` applied. */
  cards: CardRecord[];
  /** Sheets with no matching cards; their share of the slot is spread over the rest. */
  emptySheets: string[];
}

export function buildModelFromRules(rules: RulesConfig, cards: CardRecord[], setCode: string): RulesBuild {
  const members = new Map<string, number[]>();
  const labelled = [...cards];
  for (const [key, sheet] of Object.entries(rules.sheets)) {
    const idx: number[] = [];
    cards.forEach((c, i) => {
      if (matchesSheet(c, sheet, setCode)) idx.push(i);
    });
    members.set(key, idx);
    if (sheet.relabel) for (const i of idx) labelled[i] = { ...labelled[i], treatmentLabel: sheet.relabel };
  }

  const emptySheets = new Set<string>();
  const sheets: Record<string, Sheet> = {};
  const contents: Record<string, number> = {};

  rules.slots.forEach((slot, s) => {
    const entries: SheetEntry[] = [];
    for (const outcome of slot.outcomes) {
      const pool = members.get(outcome.sheet);
      const def = rules.sheets[outcome.sheet];
      if (!pool || !def) throw new Error(`Slot "${slot.label}" references unknown sheet "${outcome.sheet}"`);
      if (pool.length === 0) {
        emptySheets.add(outcome.sheet);
        continue;
      }
      const w = pool.map((i) => def.weights?.[cards[i].rarity] ?? 1);
      const total = w.reduce((a, b) => a + b, 0);
      pool.forEach((i, j) => entries.push([i, (outcome.p * w[j]) / total, outcome.foil ? 1 : 0]));
    }
    const key = `slot${s + 1}`;
    sheets[key] = { label: slot.label, entries: mergeEntries(entries) };
    contents[key] = slot.count;
  });

  return {
    model: { variants: [{ weight: 1, contents }], sheets },
    cards: labelled,
    emptySheets: [...emptySheets],
  };
}

/** Collapse duplicate (card, finish) entries that several outcomes can produce. */
function mergeEntries(entries: SheetEntry[]): SheetEntry[] {
  const map = new Map<string, SheetEntry>();
  for (const e of entries) {
    const k = `${e[0]}:${e[2]}`;
    const prev = map.get(k);
    if (prev) prev[1] += e[1];
    else map.set(k, [e[0], e[1], e[2]]);
  }
  return [...map.values()];
}

/** Scryfall searches needed to collect every card a rules config can reference. */
export function rulesQueries(rules: RulesConfig, setCode: string): string[] {
  const bySet = new Map<string, RuleSheet[]>();
  for (const sheet of Object.values(rules.sheets)) {
    const set = sheet.set ?? setCode;
    bySet.set(set, [...(bySet.get(set) ?? []), sheet]);
  }
  const queries: string[] = [];
  for (const [set, sheets] of bySet) {
    // Special Guests and similar bonus sheets live in shared sets with hundreds of
    // cards from other releases; narrow those by collector number.
    if (set !== setCode && sheets.every((s) => s.cn?.length)) {
      const ranges = sheets.flatMap((s) => s.cn!).map(([a, b]) => `(cn>=${a} cn<=${b})`);
      queries.push(`e:${set} (${ranges.join(" or ")})`);
    } else {
      queries.push(`e:${set}`);
    }
  }
  return queries;
}
