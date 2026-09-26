import type { EvParams } from "./engine/ev";
import { date, isReleased, money, percent, signedPercent } from "./format";

export type Verdict = "crack" | "toss-up" | "keep" | "early";

/**
 * What the cards return on the price paid: +0.35 means $1.35 of cards for every $1, −0.12
 * means 88¢. Null without a price or a value.
 */
export function returnOf(price: number | null | undefined, value: number): number | null {
  return price != null && price > 0 && value > 0 ? value / price - 1 : null;
}

/**
 * Within 5% either way, opening and not opening are the same bet. Before release,
 * singles prices come from a handful of preorder sales and run far above where they
 * settle, so we don't call it at all.
 */
export function verdictFor(ret: number | null, releasedAt?: string): Verdict | null {
  if (ret == null || !Number.isFinite(ret)) return null;
  if (releasedAt && !isReleased(releasedAt)) return "early";
  if (ret >= 0.05) return "crack";
  if (ret <= -0.05) return "keep";
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
  const ret = ev / price - 1;
  if (releasedAt && !isReleased(releasedAt)) {
    return `It isn’t out until ${date(releasedAt)}. Preorder singles prices rest on a handful of early sales and usually fall after launch, so read this expected value as a ceiling, not a forecast.`;
  }
  if (ret >= 0.05) {
    return `The cards inside are worth ${percent(ret)} more than the box: you’d come out about ${money(ev - price)} ahead on an average box.`;
  }
  if (ret <= -0.05) {
    return `The cards inside are worth ${percent(-ret)} less than the box costs: you’d lose about ${money(price - ev)} on an average box.`;
  }
  return `Box and cards are within 5% of each other (${signedPercent(ret)}). Open it for the fun, not the money.`;
}

/** "after 8% selling fees", "ignoring cards under 25¢, after 8% selling fees", or "at full market price". */
export function settingsPhrase(params: EvParams): string {
  const fees = Math.round(params.fees * 100);
  const floor = params.floor > 0 ? `ignoring cards under ${params.floor < 1 ? `${Math.round(params.floor * 100)}¢` : money(params.floor)}` : "";
  const fee = fees > 0 ? `after ${fees}% selling fees` : "";
  if (!floor && !fee) return "at full market price";
  return [floor, fee].filter(Boolean).join(", ");
}

/**
 * The verdict sentence for a Commander deck or Secret Lair drop. Its cards are known in
 * advance, so there's no average and no luck: the cards are simply worth this much.
 * `unpriced` counts the cards without a market price, which make the value a floor.
 */
export function fixedVerdictLine(price: number, value: number, noun: string, releasedAt?: string, unpriced = 0): string {
  const ret = value / price - 1;
  const floor = unpriced > 0 ? ` That’s before ${unpriced} card${unpriced === 1 ? "" : "s"} with no market price yet.` : "";
  if (releasedAt && !isReleased(releasedAt)) {
    return `It isn’t out until ${date(releasedAt)}. Preorder singles prices rest on a handful of early sales and usually fall after launch, so read the card value as a ceiling.`;
  }
  if (ret >= 0.05) {
    return `The cards are worth ${percent(ret)} more than the sealed ${noun}: open it, sell the singles, and you’d come out about ${money(value - price)} ahead.${floor}`;
  }
  if (ret <= -0.05) {
    return `The cards are worth ${percent(-ret)} less than the sealed ${noun}: selling them one by one would lose about ${money(price - value)}. It’s worth more sealed.`;
  }
  return `Sealed and opened are within 5% of each other (${signedPercent(ret)}). Open it to play, not for the money.`;
}
