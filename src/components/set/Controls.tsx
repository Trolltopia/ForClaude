import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { InfoTip } from "@/components/ui/tooltip";
import { date, money } from "@/lib/format";
import type { BoxPrice } from "@/lib/types";

export const FLOORS = ["0", "0.25", "0.5", "1", "2", "5"] as const;
const FLOOR_LABEL: Record<(typeof FLOORS)[number], string> = {
  "0": "Every card",
  "0.25": "25¢",
  "0.5": "50¢",
  "1": "$1",
  "2": "$2",
  "5": "$5",
};

function PriceInput({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const [text, setText] = useState(value != null ? value.toFixed(2) : "");
  useEffect(() => setText(value != null ? value.toFixed(2) : ""), [value]);
  return (
    <label className="flex h-11 w-40 items-center border border-ink bg-canvas focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-link">
      <span className="pl-3 font-sans text-[20px] font-semibold text-body">$</span>
      <input
        inputMode="decimal"
        type="number"
        min={0}
        step="0.01"
        aria-label="Box price in US dollars"
        className="h-full w-full bg-transparent px-1.5 font-sans text-[20px] font-semibold outline-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          onChange(text.trim() !== "" && Number.isFinite(n) && n > 0 ? n : null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

export function Controls({
  boxPrice,
  marketPrice,
  overridden,
  onBoxPrice,
  floor,
  onFloor,
  fees,
  onFees,
  onReset,
}: {
  boxPrice: number | null;
  marketPrice: BoxPrice;
  overridden: boolean;
  onBoxPrice: (v: number | null) => void;
  floor: string;
  onFloor: (v: (typeof FLOORS)[number]) => void;
  fees: number;
  onFees: (v: number) => void;
  onReset: () => void;
}) {
  const changed = overridden || floor !== "0" || fees !== 0;
  return (
    <div className="border-y border-ink bg-canvas lg:sticky lg:top-0 lg:z-30">
      <div className="grid gap-x-10 gap-y-5 py-3.5 md:grid-cols-[auto_auto_minmax(200px,1fr)] md:items-end">
        <div>
          <div className="mb-1.5 flex items-center gap-2 font-sans text-[13px] font-bold">
            Box price
            <InfoTip>
              What you&rsquo;d pay for a sealed 30-pack Play Booster display. Defaults to TCGplayer&rsquo;s market price; type your own to
              compare.
            </InfoTip>
          </div>
          <div className="flex items-center gap-3">
            <PriceInput value={boxPrice} onChange={onBoxPrice} />
            <div className="max-w-44 text-[12px] leading-tight text-body">
              {overridden ? (
                <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => onBoxPrice(null)}>
                  Back to {marketPrice.source === "tcgplayer" ? "market" : "estimate"}
                  {marketPrice.usd != null ? ` (${money(marketPrice.usd)})` : ""}
                </button>
              ) : marketPrice.source === "tcgplayer" ? (
                <>
                  TCGplayer market price
                  {marketPrice.asOf ? `, ${date(marketPrice.asOf)}` : ""}
                  {marketPrice.productUrl && (
                    <>
                      {" · "}
                      <a className="underline underline-offset-2 hover:text-ink" href={marketPrice.productUrl} target="_blank" rel="noreferrer">
                        listing
                      </a>
                    </>
                  )}
                </>
              ) : (
                <>Street-price estimate. Type what you&rsquo;d actually pay.</>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2 font-sans text-[13px] font-bold">
            Count cards worth at least
            <InfoTip>
              Bulk commons and uncommons are hard to sell one at a time. Set a floor and anything cheaper counts as zero — a
              truer picture of what you can actually turn into cash.
            </InfoTip>
          </div>
          <Segmented
            label="Minimum card price to count"
            value={floor as (typeof FLOORS)[number]}
            onChange={onFloor}
            options={FLOORS.map((f) => ({ value: f, label: FLOOR_LABEL[f] }))}
          />
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2 font-sans text-[13px] font-bold">
            <span className="flex items-center gap-2">
              Selling costs
              <InfoTip>
                Marketplace fees, payment processing and postage come off every sale. TCGplayer sellers typically lose 12–15% of
                the sale price; 0% shows raw market value.
              </InfoTip>
            </span>
            <span className="font-semibold">{fees}%</span>
          </div>
          <div className="flex h-11 items-center gap-4">
            <Slider aria-label="Selling costs in percent" min={0} max={30} step={1} value={[fees]} onValueChange={([v]) => onFees(v)} />
            {changed && (
              <button type="button" onClick={onReset} className="kicker shrink-0 text-body hover:text-ink">
                Reset
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
