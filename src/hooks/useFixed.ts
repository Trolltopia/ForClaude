import { useEffect, useState } from "react";
import { FIXED_PATH } from "@/lib/fixed";
import type { FixedIndex, FixedKind, FixedProduct } from "@/lib/types";
import { getJson, type Status } from "./useSnapshotIndex";

const indexes = new Map<FixedKind, Promise<FixedIndex | null>>();
const products = new Map<string, Promise<FixedProduct | null>>();

/** Every Commander deck or every Secret Lair drop, as the daily job summarised them. */
export function useFixedIndex(kind: FixedKind) {
  const [state, setState] = useState<{ status: Status; index: FixedIndex | null }>({ status: "loading", index: null });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading", index: null });
    if (!indexes.has(kind)) indexes.set(kind, getJson<FixedIndex>(`data/${FIXED_PATH[kind]}.json`).catch(() => null));
    indexes.get(kind)!.then((index) => alive && setState({ status: "ready", index }));
    return () => {
      alive = false;
    };
  }, [kind]);
  return state;
}

/** One deck or drop with its full card list. */
export function useFixedProduct(kind: FixedKind, id: string) {
  const [state, setState] = useState<{ status: Status; product: FixedProduct | null }>({ status: "loading", product: null });
  useEffect(() => {
    let alive = true;
    setState({ status: "loading", product: null });
    const key = `${FIXED_PATH[kind]}/${id}`;
    if (!products.has(key)) products.set(key, getJson<FixedProduct>(`data/${key}.json`).catch(() => null));
    products.get(key)!.then((product) => alive && setState({ status: product ? "ready" : "error", product }));
    return () => {
      alive = false;
    };
  }, [kind, id]);
  return state;
}
