import type { EvParams } from "./engine/ev";
import { date, isReleased, money, percent, ratio } from "./format";

export type Verdict = "crack" | "toss-up" | "keep" | "early";

/**
 * Within 5% either way, opening and not opening are the same bet. Before release,
 * singles prices come from a handful of preorder sales and run far above where they
 * settle, so we don't call it at all.
 */
export function verdictFor(r: number | null, releasedAt?: string): Verdict | null {
  if (r == null || !Number.isFinite(r)) return null;
  if (releasedAt && !isReleased(releasedAt)) return "early";
  if (r <= 0.95) return "crack";
  if (r >= 1.05) return "keep";
  return "toss-up";
}

export const VERDICT_TITLE: Record<Verdict, string> = {
  crack: "Crack it",
  "toss-up": "Toss-up",
  keep: "Keep it sealed",
  early: "Too early to call",
};

/** One plain sentence explaining the verdict. */
export function verdictLine(price: number, ev: number, releasedAt?: string): string {
  const r = price / ev;
  if (releasedAt && !isReleased(releasedAt)) {
    return `It isn’t out until ${date(releasedAt)}. Preorder singles prices rest on a handful of early sales and usually fall after launch, so read this expected value as a ceiling, not a forecast.`;
  }
  if (r <= 0.95) {
    return `The cards inside are worth ${percent(ev / price - 1)} more than the box — about ${money(ev - price)} a box, on average.`;
  }
  if (r >= 1.05) {
    return `The box costs ${percent(r - 1)} more than the cards inside are worth. You pay ${money(r)} for every dollar of cards.`;
  }
  return `Box and contents are within 5% of each other (${ratio(r)}). Open it for the fun, not the money.`;
}

/** "after 8% selling fees", "ignoring cards under 25¢, after 8% selling fees", or "at full market price". */
export function settingsPhrase(params: EvParams): string {
  const fees = Math.round(params.fees * 100);
  const floor = params.floor > 0 ? `ignoring cards under ${params.floor < 1 ? `${Math.round(params.floor * 100)}¢` : money(params.floor)}` : "";
  const fee = fees > 0 ? `after ${fees}% selling fees` : "";
  if (!floor && !fee) return "at full market price";
  return [floor, fee].filter(Boolean).join(", ");
}
