import { FLOOR_STEPS, type Settings } from "./settings";
import type { BoosterSummary, SetSummary } from "./types";
import { returnOf } from "./verdict";

/**
 * A booster summary's expected value and return at the reader's settings. The index stores
 * value before fees at each minimum price step; fees scale it. Older indexes only carry
 * the value at their own settings, which is used as-is for any minimum price.
 */
export function boosterAt(b: BoosterSummary, index: Pick<SetSummary, "params">, s: Settings): { evBox: number; ret: number | null } {
  const step = FLOOR_STEPS.indexOf(s.floor);
  const gross = b.gross && step >= 0 && b.gross[step] != null ? b.gross[step] : b.evBox / (1 - index.params.fees);
  const evBox = gross * (1 - s.fees / 100);
  return { evBox, ret: returnOf(b.boxPrice.usd, evBox) };
}
