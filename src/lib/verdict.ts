import { money, percent, ratio } from "./format";

export type Verdict = "crack" | "toss-up" | "keep";

/** Within 5% either way, opening and not opening are the same bet. */
export function verdictFor(r: number | null): Verdict | null {
  if (r == null || !Number.isFinite(r)) return null;
  if (r <= 0.95) return "crack";
  if (r >= 1.05) return "keep";
  return "toss-up";
}

export const VERDICT_TITLE: Record<Verdict, string> = {
  crack: "Crack it",
  "toss-up": "Toss-up",
  keep: "Keep it sealed",
};

/** One plain sentence explaining the verdict. `r` is box price ÷ expected value. */
export function verdictLine(price: number, ev: number): string {
  const r = price / ev;
  if (r <= 0.95) {
    return `The cards inside are worth ${percent(ev / price - 1)} more than the box — about ${money(ev - price)} a box, on average.`;
  }
  if (r >= 1.05) {
    return `The box costs ${percent(r - 1)} more than the cards inside are worth. You pay ${money(r)} for every dollar of cards.`;
  }
  return `Box and contents are within 5% of each other (${ratio(r)}). Open it for the fun, not the money.`;
}
