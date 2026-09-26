import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/tooltip";
import type { SimulationSummary } from "@/lib/engine/simulate";
import { chance, money, signedPercent } from "@/lib/format";
import { returnOf } from "@/lib/verdict";
import { cn } from "@/lib/utils";

function Tile({
  label,
  info,
  value,
  foot,
  hero = false,
  dimmed = false,
}: {
  label: string;
  info?: ReactNode;
  value: ReactNode;
  foot?: ReactNode;
  hero?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div className={cn("min-w-0 py-5 sm:px-6 sm:first:pl-0", "transition-opacity duration-300", dimmed && "opacity-50")}>
      <div className="flex items-center gap-2 font-sans text-[13px] font-bold text-ink">
        {label}
        {info && <InfoTip>{info}</InfoTip>}
      </div>
      <div className={cn("mt-2 font-sans font-semibold tracking-[-0.02em]", hero ? "text-[52px] leading-none sm:text-[60px]" : "text-[36px] leading-none")}>
        {value}
      </div>
      {foot && <div className="mt-2.5 text-[13px] leading-snug text-body">{foot}</div>}
    </div>
  );
}

export function KpiRow({
  evBox,
  evPack,
  boxPrice,
  sim,
  simRunning,
  provisional = false,
}: {
  evBox: number;
  evPack: number;
  boxPrice: number | null;
  sim: SimulationSummary | null;
  simRunning: boolean;
  /** Preorder prices: show the gap to the box without calling it good or bad. */
  provisional?: boolean;
}) {
  const ret = returnOf(boxPrice, evBox);
  const diff = boxPrice ? evBox - boxPrice : null;
  return (
    <div className="grid grid-cols-1 divide-hairline border-b border-hairline sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
      <Tile
        hero
        label="Expected value"
        info="The average value of the cards in a box at your settings: cards under your floor count as zero and every card loses the selling fee. A single box can land far from it."
        value={money(evBox)}
        foot={
          <>
            {money(evPack)} a pack
            {diff != null && (
              <>
                {" · "}
                <span className={provisional ? "" : diff >= 0 ? "text-good" : "text-bad"}>
                  {diff >= 0 ? "▲" : "▼"} {money(Math.abs(diff))} {diff >= 0 ? "more" : "less"} than the box costs
                  {provisional ? " (preorder prices)" : ""}
                </span>
              </>
            )}
          </>
        }
      />
      <Tile
        label="Return"
        info="What the cards are worth compared with what the box costs, on average. +35% means $135 of cards for every $100 spent; −12% means $88. Zero is break-even."
        value={<span className={provisional ? "" : ret == null ? "" : ret >= 0 ? "text-good" : "text-bad"}>{signedPercent(ret)}</span>}
        foot={ret != null ? `${money(1 + ret)} of cards for every $1 spent` : "Enter a box price"}
      />
      <Tile
        label="Boxes that beat the price"
        info="Share of ten thousand simulated boxes whose cards were worth at least the box price, with your floor and selling costs applied."
        value={sim?.beatPrice != null ? chance(sim.beatPrice) : "—"}
        dimmed={simRunning && sim != null}
        foot={sim?.doublePrice != null ? `${chance(sim.doublePrice)} doubled their money` : "Simulating…"}
      />
      <Tile
        label="The typical box"
        info="The median simulated box: half of boxes are worth more, half less. It sits below the average because a few huge pulls drag the average up."
        value={sim ? money(sim.percentiles.p50) : "—"}
        dimmed={simRunning && sim != null}
        foot={sim ? `Half of all boxes land between ${money(sim.percentiles.p25, { cents: false })} and ${money(sim.percentiles.p75, { cents: false })}` : "Simulating…"}
      />
    </div>
  );
}
