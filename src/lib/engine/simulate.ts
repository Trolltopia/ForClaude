import type { BoosterModel, CardRecord } from "../types";
import { priceOf, realisedValue, type EvParams } from "./ev";
import { createAliasSampler, createRng } from "./random";

/**
 * A booster model flattened into typed arrays so the hot loop only touches numbers.
 * Values already include the bulk floor and fees.
 */
export interface CompiledModel {
  variantWeights: number[];
  /** Per variant: list of [sheet index, count]. */
  variantContents: [number, number][][];
  sheetKeys: string[];
  sheetEntries: { cardIndex: Int32Array; foil: Uint8Array; weight: Float64Array; value: Float64Array }[];
}

export function compileModel(model: BoosterModel, cards: CardRecord[], params: EvParams): CompiledModel {
  const sheetKeys = Object.keys(model.sheets);
  const sheetIndex = new Map(sheetKeys.map((k, i) => [k, i]));
  const sheetEntries = sheetKeys.map((k) => {
    const entries = model.sheets[k].entries.filter(([i]) => cards[i] != null);
    const cardIndex = new Int32Array(entries.length);
    const foil = new Uint8Array(entries.length);
    const weight = new Float64Array(entries.length);
    const value = new Float64Array(entries.length);
    entries.forEach(([i, w, f], j) => {
      cardIndex[j] = i;
      foil[j] = f;
      weight[j] = w;
      value[j] = realisedValue(priceOf(cards[i], f === 1), params);
    });
    return { cardIndex, foil, weight, value };
  });
  return {
    variantWeights: model.variants.map((v) => v.weight),
    variantContents: model.variants.map((v) =>
      Object.entries(v.contents)
        .filter(([k, n]) => n > 0 && sheetIndex.has(k) && sheetEntries[sheetIndex.get(k)!].weight.length > 0)
        .map(([k, n]) => [sheetIndex.get(k)!, n] as [number, number]),
    ),
    sheetKeys,
    sheetEntries,
  };
}

function samplers(compiled: CompiledModel) {
  return {
    variant: createAliasSampler(compiled.variantWeights),
    sheets: compiled.sheetEntries.map((s) => createAliasSampler(s.weight)),
  };
}

/** Open `boxes` boxes of `packs` packs and return each box's total realised value. */
export function simulateBoxValues(compiled: CompiledModel, packs: number, boxes: number, seed: number): Float64Array {
  const rng = createRng(seed);
  const { variant, sheets } = samplers(compiled);
  const out = new Float64Array(boxes);
  const contents = compiled.variantContents;
  const values = compiled.sheetEntries.map((s) => s.value);
  for (let b = 0; b < boxes; b++) {
    let total = 0;
    for (let p = 0; p < packs; p++) {
      const layout = contents[variant(rng())];
      for (let s = 0; s < layout.length; s++) {
        const [sheet, count] = layout[s];
        const pick = sheets[sheet];
        const vals = values[sheet];
        for (let c = 0; c < count; c++) total += vals[pick(rng())];
      }
    }
    out[b] = total;
  }
  return out;
}

export interface Pull {
  cardIndex: number;
  foil: boolean;
  value: number;
  sheet: string;
}

export interface OpenedBox {
  packs: Pull[][];
  total: number;
}

/** Open a single box card by card, keeping every pull, for the "open a box" view. */
export function openBox(compiled: CompiledModel, packs: number, seed: number): OpenedBox {
  const rng = createRng(seed);
  const { variant, sheets } = samplers(compiled);
  const opened: Pull[][] = [];
  let total = 0;
  for (let p = 0; p < packs; p++) {
    const pack: Pull[] = [];
    for (const [sheet, count] of compiled.variantContents[variant(rng())]) {
      const entries = compiled.sheetEntries[sheet];
      for (let c = 0; c < count; c++) {
        const j = sheets[sheet](rng());
        const value = entries.value[j];
        total += value;
        pack.push({ cardIndex: entries.cardIndex[j], foil: entries.foil[j] === 1, value, sheet: compiled.sheetKeys[sheet] });
      }
    }
    opened.push(pack);
  }
  return { packs: opened, total };
}

export interface HistogramBin {
  from: number;
  to: number;
  count: number;
  share: number;
  /** True for the last bin, which also holds everything above `to`. */
  overflow: boolean;
}

export interface SimulationSummary {
  boxes: number;
  mean: number;
  percentiles: { p5: number; p10: number; p25: number; p50: number; p75: number; p90: number; p95: number; p99: number };
  min: number;
  max: number;
  /** Share of boxes worth at least the box price (null without a price). */
  beatPrice: number | null;
  /** Share of boxes worth at least twice the box price. */
  doublePrice: number | null;
  bins: HistogramBin[];
}

function niceStep(raw: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

export function summarise(values: Float64Array, boxPrice: number | null, targetBins = 28): SimulationSummary {
  const sorted = Float64Array.from(values).sort();
  const n = sorted.length;
  const q = (p: number) => {
    if (n === 0) return 0;
    const pos = (n - 1) * p;
    const lo = Math.floor(pos);
    const hi = Math.min(n - 1, lo + 1);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  };
  let sum = 0;
  for (let i = 0; i < n; i++) sum += sorted[i];

  const percentiles = {
    p5: q(0.05),
    p10: q(0.1),
    p25: q(0.25),
    p50: q(0.5),
    p75: q(0.75),
    p90: q(0.9),
    p95: q(0.95),
    p99: q(0.99),
  };

  // Box values have a long right tail; bin up to the 99th percentile and fold the rest
  // into a final overflow bin so a single lucky box doesn't flatten the chart.
  const lo = Math.max(0, q(0.001));
  const hiTarget = Math.max(percentiles.p99, boxPrice ?? 0) * 1.02;
  const step = niceStep(Math.max(1e-6, (hiTarget - lo) / targetBins));
  const start = Math.floor(lo / step) * step;
  const binCount = Math.max(1, Math.ceil((hiTarget - start) / step));
  const counts = new Array<number>(binCount).fill(0);
  for (let i = 0; i < n; i++) {
    const idx = Math.floor((sorted[i] - start) / step);
    counts[Math.min(binCount - 1, Math.max(0, idx))]++;
  }
  const bins: HistogramBin[] = counts.map((count, i) => ({
    from: start + i * step,
    to: start + (i + 1) * step,
    count,
    share: n ? count / n : 0,
    overflow: i === binCount - 1 && sorted[n - 1] > start + (i + 1) * step,
  }));

  const atLeast = (x: number) => {
    // First index with value >= x, by binary search.
    let a = 0;
    let b = n;
    while (a < b) {
      const m = (a + b) >> 1;
      if (sorted[m] < x) a = m + 1;
      else b = m;
    }
    return n ? (n - a) / n : 0;
  };

  return {
    boxes: n,
    mean: n ? sum / n : 0,
    percentiles,
    min: n ? sorted[0] : 0,
    max: n ? sorted[n - 1] : 0,
    beatPrice: boxPrice != null && boxPrice > 0 ? atLeast(boxPrice) : null,
    doublePrice: boxPrice != null && boxPrice > 0 ? atLeast(boxPrice * 2) : null,
    bins,
  };
}
