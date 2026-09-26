import { useSyncExternalStore } from "react";
import type { EvParams } from "./engine/ev";

/**
 * How cards are counted everywhere on the site: which are too cheap to bother selling,
 * and what selling costs. One setting for every page, remembered in this browser.
 */
export interface Settings {
  /** Cards priced under this many dollars count as nothing. Always one of FLOOR_STEPS. */
  floor: number;
  /** Selling fees in percent of each card's price. */
  fees: number;
}

export const DEFAULT_SETTINGS: Settings = { floor: 0, fees: 8 };

/** Up to half: enough for a store that sells on to other stores rather than card by card. */
export const MAX_FEES = 50;

/**
 * The minimum card prices the daily index can answer exactly: every 5¢ up to $2, then
 * wider steps. The index stores each box's card value at each of these.
 */
export const FLOOR_STEPS: number[] = [
  ...Array.from({ length: 41 }, (_, i) => (i * 5) / 100),
  2.5, 3, 4, 5, 7.5, 10, 15, 20, 25, 50, 100,
];

/** The step nearest to a typed-in minimum price. */
export function snapFloor(x: number): number {
  if (!Number.isFinite(x) || x <= 0) return 0;
  let best = FLOOR_STEPS[0];
  for (const step of FLOOR_STEPS) if (Math.abs(step - x) < Math.abs(best - x)) best = step;
  return best;
}

export function toParams(s: Settings): EvParams {
  return { floor: s.floor, fees: s.fees / 100 };
}

function normalise(s: Partial<Settings>): Settings {
  const fees = Number(s.fees);
  return {
    floor: snapFloor(Number(s.floor)),
    fees: Number.isFinite(fees) ? Math.max(0, Math.min(MAX_FEES, Math.round(fees))) : DEFAULT_SETTINGS.fees,
  };
}

const KEY = "ck-settings";

// Storage can be missing or blocked (private windows, previews); the defaults still work.
function read(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? normalise(JSON.parse(raw) as Partial<Settings>) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

let current: Settings = typeof window === "undefined" ? DEFAULT_SETTINGS : read();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>) {
  current = normalise({ ...current, ...patch });
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not remembered, but this visit still uses it.
  }
  emit();
}

if (typeof window !== "undefined") {
  // Another tab changed them.
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      current = read();
      emit();
    }
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The site-wide settings and a setter; every page that reads them updates together. */
export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
  return [settings, setSettings] as const;
}

export function isDefault(s: Settings): boolean {
  return s.floor === DEFAULT_SETTINGS.floor && s.fees === DEFAULT_SETTINGS.fees;
}
