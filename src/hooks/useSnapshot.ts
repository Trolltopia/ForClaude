import { useCallback, useEffect, useState } from "react";
import { upgradeSnapshot } from "@/lib/boosters";
import { buildSetSnapshot, refreshPricesViaSearch } from "@/lib/data/build";
import { createScryfallClient } from "@/lib/data/scryfall";
import type { SetSnapshot } from "@/lib/types";
import { catalogEntry } from "@/sets/catalog";
import { getJson, type Status } from "./useSnapshotIndex";

// Scryfall asks for a pause between requests; searches are the slower, rate-limited kind.
const scryfall = createScryfallClient({ delayMs: 250 });

export interface SnapshotState {
  status: Status;
  /** The set with every booster it has; pick one with boosterView. */
  snapshot: SetSnapshot | null;
  /** True when the snapshot was built in this browser rather than by the daily job. */
  live: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const cache = new Map<string, { snapshot: SetSnapshot; live: boolean }>();

async function loadSnapshot(code: string): Promise<{ snapshot: SetSnapshot; live: boolean }> {
  const hit = cache.get(code);
  if (hit) return hit;
  const stored = await getJson<Parameters<typeof upgradeSnapshot>[0]>(`data/${code}.json`).catch(() => null);
  if (stored) {
    const out = { snapshot: upgradeSnapshot(stored), live: false };
    cache.set(code, out);
    return out;
  }
  // No snapshot from the daily job (e.g. running locally before `npm run data`):
  // build one from Scryfall directly when we have a collation for the set.
  const entry = catalogEntry(code);
  if (!entry?.boosters.some((b) => b.rules)) throw new Error("No price snapshot for this set yet.");
  const out = { snapshot: await buildSetSnapshot(entry, { client: scryfall }), live: true };
  cache.set(code, out);
  return out;
}

export function useSnapshot(code: string): SnapshotState {
  const [state, setState] = useState<Omit<SnapshotState, "refresh">>({
    status: "loading",
    snapshot: cache.get(code)?.snapshot ?? null,
    live: cache.get(code)?.live ?? false,
    refreshing: false,
    error: null,
  });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, status: cache.has(code) ? "ready" : "loading", snapshot: cache.get(code)?.snapshot ?? null, error: null }));
    loadSnapshot(code)
      .then(({ snapshot, live }) => alive && setState({ status: "ready", snapshot, live, refreshing: false, error: null }))
      .catch((err: Error) => alive && setState({ status: "error", snapshot: null, live: false, refreshing: false, error: err.message }));
    return () => {
      alive = false;
    };
  }, [code]);

  const refresh = useCallback(async () => {
    const current = cache.get(code);
    if (!current) return;
    setState((s) => ({ ...s, refreshing: true, error: null }));
    try {
      const snapshot = await refreshPricesViaSearch(current.snapshot, scryfall);
      cache.set(code, { snapshot, live: true });
      setState({ status: "ready", snapshot, live: true, refreshing: false, error: null });
    } catch (err) {
      setState((s) => ({ ...s, refreshing: false, error: `Couldn't reach Scryfall: ${(err as Error).message}` }));
    }
  }, [code]);

  return { ...state, refresh };
}
