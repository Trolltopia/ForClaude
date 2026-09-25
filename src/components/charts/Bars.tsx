import { useState } from "react";
import { money, ratio } from "@/lib/format";
import { cn } from "@/lib/utils";

/** A single horizontal bar inside a table cell. The number beside it carries the value. */
export function ShareBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) * 100 : 0;
  return (
    <div className={cn("h-2.5 w-full", className)} aria-hidden="true">
      <div className="h-full rounded-r-[3px] bg-accent" style={{ width: `${pct}%`, minWidth: value > 0 ? 2 : 0 }} />
    </div>
  );
}

/**
 * Price-to-value on a scale centred at 1.00×. Left of centre (blue) the cards are worth
 * more than the box; right of centre (red) the box costs more than its cards.
 */
export function RatioMeter({ value, domain = [0.5, 1.5] }: { value: number | null; domain?: [number, number] }) {
  if (value == null) return <div className="h-3 w-full" aria-hidden="true" />;
  const [lo, hi] = domain;
  const clamped = Math.max(lo, Math.min(hi, value));
  const pos = ((clamped - lo) / (hi - lo)) * 100;
  const left = Math.min(pos, 50);
  const width = Math.abs(pos - 50);
  const crack = value <= 1;
  return (
    <div className="relative h-3 w-full" aria-hidden="true">
      <div className="absolute inset-x-0 top-1/2 h-px bg-hairline" />
      <div className="absolute top-0 left-1/2 h-full w-px bg-ink" />
      <div
        className={cn("absolute top-1/2 h-[3px] -translate-y-1/2", crack ? "bg-accent" : "bg-keep")}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
      <div
        className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-canvas", crack ? "bg-accent" : "bg-keep")}
        style={{ left: `${pos}%` }}
      />
      <span className="sr-only">{ratio(value)}</span>
    </div>
  );
}

/** Value of each pack in an opened box, one column per pack, with a hover readout. */
export function PackBars({ values, best }: { values: number[]; best: (i: number) => string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...values, 1);
  return (
    <div className="relative">
      <div className="flex h-28 items-end gap-[2px]" onPointerLeave={() => setActive(null)}>
        {values.map((v, i) => (
          <button
            key={i}
            type="button"
            className="group flex h-full flex-1 items-end outline-none"
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            aria-label={`Pack ${i + 1}: ${money(v)}, best card ${best(i)}`}
          >
            <span
              className={cn("block w-full rounded-t-[3px] bg-accent transition-opacity", active != null && active !== i && "opacity-45")}
              style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted">
        <span>Pack 1</span>
        <span>Pack {values.length}</span>
      </div>
      {active != null && (
        <div
          className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full bg-ink px-3 py-2 whitespace-nowrap text-canvas"
          style={{ left: `${((active + 0.5) / values.length) * 100}%` }}
        >
          <div className="num font-sans text-[14px] font-bold">{money(values[active])}</div>
          <div className="font-sans text-[12px] opacity-80">
            Pack {active + 1} · best: {best(active)}
          </div>
        </div>
      )}
    </div>
  );
}
