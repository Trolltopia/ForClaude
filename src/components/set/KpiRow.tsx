import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/tooltip";
import type { SimulationSummary } from "@/lib/engine/simulate";
import { money, percent, ratio, signedMoney } from "@/lib/format";
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
}: {
  evBox: number;
  evPack: number;
  boxPrice: number | null;
  sim: SimulationSummary | null;
  simRunning: boolean;
}) {
  const r = boxPrice && evBox > 0 ? boxPrice / evBox : null;
  const diff = boxPrice ? evBox - boxPrice : null;
  return (
    <div className="grid grid-cols-1 divide-hairline border-b border-hairline sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
      <Tile
        hero
        label="Expected value"
        info="The average value of the cards in a box, over every box that could be opened. A single box can land far from it."
        value={money(evBox)}
        foot={
          <>
            {money(evPack)} a pack
            {diff != null && (
              <>
                {" · "}
                <span className={diff >= 0 ? "text-good" : "text-bad"}>
                  {diff >= 0 ? "▲" : "▼"} {signedMoney(diff)} vs. the box
                </span>
              </>
            )}
          </>
        }
      />
      <Tile
        label="Price ÷ value"
        info="Box price divided by expected value. 1.00× is break-even; 1.25× means paying $125 for every $100 of cards; 0.90× means paying $90."
        value={ratio(r)}
        foot={r != null ? (r <= 1 ? `${money(1 / r)} of cards for every $1 spent` : `${money(r)} spent for every $1 of cards`) : "Enter a box price"}
      />
      <Tile
        label="Boxes that beat the price"
        info="Share of ten thousand simulated boxes whose cards were worth at least the box price, with your floor and selling costs applied."
        value={sim?.beatPrice != null ? percent(sim.beatPrice) : "—"}
        dimmed={simRunning && sim != null}
        foot={sim?.doublePrice != null ? `${percent(sim.doublePrice, sim.doublePrice < 0.01 ? 1 : 0)} doubled their money` : "Simulating…"}
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
