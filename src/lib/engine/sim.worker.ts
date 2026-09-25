/// <reference lib="webworker" />
import type { BoosterModel, CardRecord } from "../types";
import type { EvParams } from "./ev";
import { compileModel, simulateBoxValues, summarise, type SimulationSummary } from "./simulate";

export interface SimRequest {
  id: number;
  model: BoosterModel;
  cards: CardRecord[];
  params: EvParams;
  packs: number;
  boxes: number;
  boxPrice: number | null;
  seed: number;
}

export interface SimResponse {
  id: number;
  summary: SimulationSummary;
  ms: number;
}

self.onmessage = (event: MessageEvent<SimRequest>) => {
  const { id, model, cards, params, packs, boxes, boxPrice, seed } = event.data;
  const started = performance.now();
  const compiled = compileModel(model, cards, params);
  const values = simulateBoxValues(compiled, packs, boxes, seed);
  const summary = summarise(values, boxPrice);
  const response: SimResponse = { id, summary, ms: performance.now() - started };
  self.postMessage(response);
};
