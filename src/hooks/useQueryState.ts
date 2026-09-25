import { useCallback, useMemo } from "react";
import { useSearch } from "wouter";

/**
 * Numeric settings kept in the query string so a configured calculator can be shared
 * as a link, e.g. /sets/fra?box=139.99&floor=1&fees=12.
 */
export function useQueryNumbers<K extends string>(keys: readonly K[]) {
  const search = useSearch();
  const values = useMemo(() => {
    const params = new URLSearchParams(search);
    const out = {} as Record<K, number | null>;
    for (const k of keys) {
      const raw = params.get(k);
      const n = raw == null || raw === "" ? Number.NaN : Number(raw);
      out[k] = Number.isFinite(n) ? n : null;
    }
    return out;
  }, [search, keys]);

  const set = useCallback(
    (patch: Partial<Record<K, number | null>>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [k, v] of Object.entries(patch) as [K, number | null][]) {
        if (v == null) params.delete(k);
        else params.set(k, String(Math.round(v * 100) / 100));
      }
      const qs = params.toString();
      const url = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
      // replaceState keeps slider drags out of the back-button history; wouter
      // patches it to notify useSearch subscribers.
      window.history.replaceState(window.history.state, "", url);
    },
    [],
  );

  return [values, set] as const;
}
