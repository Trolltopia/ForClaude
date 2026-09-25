import { useEffect, useRef, useState } from "react";
import type { EvParams } from "@/lib/engine/ev";
import type { SimRequest, SimResponse } from "@/lib/engine/sim.worker";
import type { SimulationSummary } from "@/lib/engine/simulate";
import type { Snapshot } from "@/lib/types";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: SimResponse) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../lib/engine/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<SimResponse>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

export const SIM_BOXES = 10_000;

export function useSimulation(snapshot: Snapshot | null, params: EvParams, boxPrice: number | null, seed = 20261002) {
  const [summary, setSummary] = useState<SimulationSummary | null>(null);
  const [running, setRunning] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    if (!snapshot) return;
    setRunning(true);
    // Debounce so dragging the fee slider doesn't queue dozens of runs.
    const timer = setTimeout(() => {
      const id = nextId++;
      latest.current = id;
      const request: SimRequest = {
        id,
        model: snapshot.model,
        cards: snapshot.cards,
        params,
        packs: snapshot.product.packsPerBox,
        boxes: SIM_BOXES,
        boxPrice,
        seed,
      };
      pending.set(id, (res) => {
        if (res.id !== latest.current) return;
        setSummary(res.summary);
        setRunning(false);
      });
      getWorker().postMessage(request);
    }, 160);
    return () => clearTimeout(timer);
  }, [snapshot, params, boxPrice, seed]);

  return { summary, running };
}
