import { useMemo, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { Histogram } from "@/components/charts/Histogram";
import { PackBars } from "@/components/charts/Bars";
import { Button } from "@/components/ui/button";
import { SIM_BOXES } from "@/hooks/useSimulation";
import type { EvParams } from "@/lib/engine/ev";
import { compileModel, openBox, type OpenedBox, type SimulationSummary } from "@/lib/engine/simulate";
import { chance, count, money, signedMoney } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-body">
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 bg-accent" aria-hidden="true" /> Boxes worth the price or more
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3 w-3 bg-deemph" aria-hidden="true" /> Boxes worth less
      </li>
      <li className="flex items-center gap-2">
        <svg viewBox="0 0 10 7" className="h-2 w-3" aria-hidden="true">
          <path d="M0 7L5 0l5 7z" fill="var(--ink)" />
        </svg>
        Expected value
      </li>
    </ul>
  );
}

function Percentiles({ sim, boxPrice }: { sim: SimulationSummary; boxPrice: number | null }) {
  const rows: [string, string, boolean?][] = [
    ["Worst box in ten", money(sim.percentiles.p10)],
    ["Worst box in four", money(sim.percentiles.p25)],
    ["Typical box (median)", money(sim.percentiles.p50), true],
    ["Average box", money(sim.mean), true],
    ["Best box in four", money(sim.percentiles.p75)],
    ["Best box in ten", money(sim.percentiles.p90)],
    ["Best box in a hundred", money(sim.percentiles.p99)],
  ];
  return (
    <table className="w-full border-collapse text-[14px]">
      <caption className="sr-only">Simulated box values by percentile</caption>
      <tbody>
        {rows.map(([label, value, strong]) => (
          <tr key={label} className="border-b border-hairline">
            <th scope="row" className={cn("py-2 pr-3 text-left font-normal text-body", strong && "font-semibold text-ink")}>
              {label}
            </th>
            <td className={cn("num py-2 text-right", strong && "font-semibold")}>{value}</td>
          </tr>
        ))}
        {boxPrice != null && sim.beatPrice != null && (
          <tr className="border-b border-ink">
            <th scope="row" className="py-2 pr-3 text-left font-semibold">
              Beat {money(boxPrice)}
            </th>
            <td className="num py-2 text-right font-semibold">{chance(sim.beatPrice)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function OpenABox({ snapshot, params, boxPrice }: { snapshot: Snapshot; params: EvParams; boxPrice: number | null }) {
  const compiled = useMemo(() => compileModel(snapshot.model, snapshot.cards, params), [snapshot, params]);
  const [box, setBox] = useState<OpenedBox | null>(null);
  const [n, setN] = useState(0);

  const open = () => {
    setN((x) => x + 1);
    setBox(openBox(compiled, snapshot.product.packsPerBox, (Date.now() ^ (n * 2654435761)) >>> 0));
  };

  const pulls = box?.packs.flat() ?? [];
  const hitFloor = Math.max(2, params.floor);
  const hits = pulls.filter((p) => p.value >= hitFloor).sort((a, b) => b.value - a.value);
  const rest = pulls.filter((p) => p.value < hitFloor);
  const restValue = rest.reduce((s, p) => s + p.value, 0);
  const packValues = box?.packs.map((p) => p.reduce((s, x) => s + x.value, 0)) ?? [];
  const bestIn = (i: number) => {
    const best = [...(box?.packs[i] ?? [])].sort((a, b) => b.value - a.value)[0];
    return best ? `${snapshot.cards[best.cardIndex].name} ${money(best.value)}` : "—";
  };
  const diff = box && boxPrice ? box.total - boxPrice : null;

  return (
    <div className="mt-14 border-t border-hairline pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="display text-[30px] leading-none">Open one yourself</h3>
          <p className="mt-2 max-w-lg text-[14px] text-body">
            Each press opens a fresh box of {snapshot.product.packsPerBox} packs using the same odds and prices as above.
          </p>
        </div>
        <Button onClick={open}>{box ? "Open another box" : "Open a box"}</Button>
      </div>

      {box && (
        <div className="mt-8" aria-live="polite">
          <p className="display text-[36px] leading-[1.05] sm:text-[44px]">
            {money(box.total)} of cards
            {diff != null && (
              <span className="text-body">
                {" "}
                — {diff >= 0 ? `${money(diff)} more than you paid.` : `${money(-diff)} short of the box.`}
              </span>
            )}
          </p>
          <p className="mt-2 text-[13px] text-body">
            Box no. {n} · {count(pulls.length)} cards · {hits.length} worth {money(hitFloor, { cents: false })} or more
            {diff != null && ` · ${signedMoney(diff)}`}
          </p>

          <div className="mt-8">
            <PackBars values={packValues} best={bestIn} />
          </div>

          {hits.length > 0 && (
            <ul className="mt-8 flex gap-4 overflow-x-auto pb-3">
              {hits.slice(0, 16).map((p, i) => {
                const card = snapshot.cards[p.cardIndex];
                return (
                  <li key={i} className="group w-32 shrink-0 sm:w-36">
                    <CardImage card={card} foil={p.foil} />
                    <div className="mt-2 truncate text-[13px] font-semibold" title={card.name}>
                      {card.name}
                    </div>
                    <div className="num text-[13px] text-body">
                      {money(p.value)}
                      {p.foil ? " · foil" : ""}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-body">
            {hits.length > 16 ? `…and ${hits.length - 16} more hits. ` : ""}
            The other {count(rest.length)} cards come to {money(restValue)} together.
          </p>
        </div>
      )}
    </div>
  );
}

export function SimulationSection({
  snapshot,
  params,
  boxPrice,
  sim,
  running,
}: {
  snapshot: Snapshot;
  params: EvParams;
  boxPrice: number | null;
  sim: SimulationSummary | null;
  running: boolean;
}) {
  return (
    <div>
      {sim ? (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
          <figure className="min-w-0">
            <div className="mb-5">
              <Legend />
            </div>
            <Histogram bins={sim.bins} boxPrice={boxPrice} mean={sim.mean} dimmed={running} />
            <figcaption className="mt-3 text-[13px] text-body">
              {count(SIM_BOXES)} boxes opened at random, card by card. Each column is the share of boxes worth that much.
            </figcaption>
          </figure>
          <div className={cn("transition-opacity duration-300", running && "opacity-50")}>
            <Percentiles sim={sim} boxPrice={boxPrice} />
          </div>
        </div>
      ) : (
        <div className="flex h-72 items-center justify-center border border-hairline text-[14px] text-body">
          Opening {count(SIM_BOXES)} boxes…
        </div>
      )}
      <OpenABox snapshot={snapshot} params={params} boxPrice={boxPrice} />
    </div>
  );
}
