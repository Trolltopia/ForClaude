import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import type { HistogramBin } from "@/lib/engine/simulate";
import { money, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

const H = 260;
const M = { top: 30, right: 10, bottom: 30, left: 40 };

function niceTicks(max: number, target: number): number[] {
  const raw = max / target;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v <= max + 1e-9; v += step) ticks.push(v);
  return ticks;
}

/** Column path with 3px rounded data-end and a square base. */
function column(x: number, y: number, w: number, h: number) {
  const r = Math.min(3, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Distribution of simulated box values. Columns at or above the box price carry the
 * accent; the rest are de-emphasised, so the share of winning boxes reads at a glance.
 */
export function Histogram({
  bins,
  boxPrice,
  mean,
  dimmed = false,
}: {
  bins: HistogramBin[];
  boxPrice: number | null;
  mean: number;
  dimmed?: boolean;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    const x0 = bins[0]?.from ?? 0;
    const x1 = bins[bins.length - 1]?.to ?? 1;
    const maxShare = Math.max(...bins.map((b) => b.share), 0.0001);
    const yTicks = niceTicks(maxShare, 3);
    const yMax = yTicks[yTicks.length - 1] < maxShare ? maxShare : yTicks[yTicks.length - 1];
    const innerW = Math.max(10, width - M.left - M.right);
    const innerH = H - M.top - M.bottom;
    const x = (v: number) => M.left + ((v - x0) / (x1 - x0)) * innerW;
    const y = (s: number) => M.top + innerH - (s / yMax) * innerH;
    const xTickStep = niceTicks(x1 - x0, width < 480 ? 3 : 6)[1] ?? x1 - x0;
    const xTicks: number[] = [];
    for (let v = Math.ceil(x0 / xTickStep) * xTickStep; v <= x1 + 1e-9; v += xTickStep) xTicks.push(v);
    return { x0, x1, x, y, yTicks, innerW, innerH, xTicks, colW: innerW / bins.length };
  }, [bins, width]);

  const overflow = bins[bins.length - 1]?.overflow;
  const priceX = boxPrice != null && boxPrice >= geo.x0 && boxPrice <= geo.x1 ? geo.x(boxPrice) : null;
  const meanX = mean >= geo.x0 && mean <= geo.x1 ? geo.x(mean) : null;
  const priceLabelLeft = priceX != null && priceX > width - 120;

  const indexAt = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.floor((e.clientX - rect.left - M.left) / geo.colW);
    return i >= 0 && i < bins.length ? i : null;
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    setActive((a) => {
      const start = a ?? 0;
      return Math.max(0, Math.min(bins.length - 1, start + (e.key === "ArrowRight" ? 1 : -1)));
    });
  };

  const tip = active != null ? bins[active] : null;
  const tipX = active != null ? M.left + (active + 0.5) * geo.colW : 0;

  return (
    <div ref={ref} className={cn("relative transition-opacity duration-300", dimmed && "opacity-50")}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Histogram of simulated box values from ${money(geo.x0)} to ${money(geo.x1)}${
          boxPrice != null ? `, with the box price at ${money(boxPrice)}` : ""
        }. Use the left and right arrow keys to read each bar.`}
        tabIndex={0}
        className="block touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link"
        onPointerMove={(e) => setActive(indexAt(e))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {/* Recessive grid: solid hairlines, labels in muted ink. */}
        {geo.yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={geo.y(t)} y2={geo.y(t)} stroke="var(--hairline)" />
            <text x={M.left - 8} y={geo.y(t)} dy="0.32em" textAnchor="end" className="num fill-muted text-[11px]">
              {percent(t)}
            </text>
          </g>
        ))}

        {bins.map((b, i) => {
          const mid = (b.from + b.to) / 2;
          const won = boxPrice != null && mid >= boxPrice;
          const h = geo.y(0) - geo.y(b.share);
          const x = M.left + i * geo.colW + 1;
          const w = Math.max(1, geo.colW - 2);
          if (h <= 0) return null;
          return (
            <path
              key={i}
              d={column(x, geo.y(b.share), w, h)}
              fill={won ? "var(--accent)" : "var(--deemph)"}
              opacity={active == null || active === i ? 1 : 0.55}
            />
          );
        })}

        <line x1={M.left} x2={width - M.right} y1={geo.y(0)} y2={geo.y(0)} stroke="var(--ink)" />
        {geo.xTicks.map((t, i) => {
          const last = i === geo.xTicks.length - 1 && overflow && Math.abs(t - geo.x1) < 1e-6;
          return (
            <text key={t} x={geo.x(t)} y={H - M.bottom + 18} textAnchor="middle" className="num fill-muted text-[11px]">
              {money(t, { cents: false })}
              {last ? "+" : ""}
            </text>
          );
        })}

        {meanX != null && (
          <g>
            <path d={`M${meanX - 5},${geo.y(0) + 7}L${meanX},${geo.y(0) + 1}L${meanX + 5},${geo.y(0) + 7}Z`} fill="var(--ink)" />
          </g>
        )}

        {priceX != null && (
          <g>
            <line x1={priceX} x2={priceX} y1={M.top - 14} y2={geo.y(0)} stroke="var(--ink)" strokeWidth={2} />
            <text
              x={priceLabelLeft ? priceX - 7 : priceX + 7}
              y={M.top - 6}
              textAnchor={priceLabelLeft ? "end" : "start"}
              className="fill-ink font-sans text-[12px] font-bold"
            >
              Box price {money(boxPrice)}
            </text>
          </g>
        )}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full bg-ink px-3 py-2 whitespace-nowrap text-canvas"
          style={{ left: Math.min(Math.max(tipX, 70), width - 70), top: Math.max(8, geo.y(tip.share) - 8) }}
          role="status"
        >
          <div className="num font-sans text-[15px] font-bold">{percent(tip.share, 1)} of boxes</div>
          <div className="num font-sans text-[12px] opacity-80">
            worth {money(tip.from, { cents: false })}–{money(tip.to, { cents: false })}
            {tip.overflow ? " or more" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
