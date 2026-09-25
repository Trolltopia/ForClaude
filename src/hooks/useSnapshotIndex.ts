import { useEffect, useState } from "react";
import type { SnapshotIndex } from "@/lib/types";
import { asset } from "@/lib/utils";

export type Status = "loading" | "ready" | "error";

export async function getJson<T>(path: string): Promise<T | null> {
  const res = await fetch(asset(path), { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  // Static hosts answer unknown paths with the SPA's 404.html, so check the type.
  if (!(res.headers.get("content-type") ?? "").includes("json")) return null;
  return (await res.json()) as T;
}

let indexPromise: Promise<SnapshotIndex | null> | null = null;

export function useSnapshotIndex() {
  const [state, setState] = useState<{ status: Status; index: SnapshotIndex | null }>({ status: "loading", index: null });
  useEffect(() => {
    let alive = true;
    indexPromise ??= getJson<SnapshotIndex>("data/index.json").catch(() => null);
    indexPromise.then((index) => alive && setState({ status: "ready", index }));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
