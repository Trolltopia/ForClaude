import { useEffect, useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { InfoTip } from "@/components/ui/tooltip";
import { date, money } from "@/lib/format";
import { MAX_FEES, snapFloor } from "@/lib/settings";
import type { BoxPrice } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Bulk-floor presets in dollars; any other amount goes in the custom box. */
export const FLOOR_PRESETS = [0, 0.1, 0.25, 0.5, 1, 2] as const;
export const floorLabel = (v: number) => (v === 0 ? "Nothing" : v < 1 ? `${Math.round(v * 100)}¢` : `$${v}`);

export function FloorInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const custom = !FLOOR_PRESETS.includes(value as (typeof FLOOR_PRESETS)[number]);
  const [text, setText] = useState(custom ? String(value) : "");
  useEffect(() => setText(custom ? String(value) : ""), [value, custom]);
  const commit = () => {
    const n = Number(text.replace(/[$¢\s]/g, ""));
    if (text.trim() === "") return;
    if (Number.isFinite(n) && n >= 0) onChange(snapFloor(n));
  };
  return (
    <label
      className={cn(
        "flex h-8 w-[76px] items-center border border-ink bg-canvas focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-link",
        custom && "bg-ink text-canvas",
      )}
    >
      <span className={cn("pl-2 text-[13px] font-semibold", custom ? "text-canvas" : "text-body")}>$</span>
      <input
        inputMode="decimal"
        type="number"
        min={0}
        step="0.05"
        placeholder="other"
        aria-label="Custom minimum card price in dollars"
        className="h-full w-full bg-transparent px-1 text-[13px] font-semibold outline-none placeholder:font-normal placeholder:text-muted"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

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
  productName,
  packsPerBox,
  defaultFees,
}: {
  /** "Play Booster", "Collector Booster". */
  productName: string;
  packsPerBox: number;
  boxPrice: number | null;
  marketPrice: BoxPrice;
  overridden: boolean;
  onBoxPrice: (v: number | null) => void;
  /** Minimum card price in dollars; cheaper cards count as zero. */
  floor: number;
  onFloor: (v: number) => void;
  /** Selling fees in percent. */
  fees: number;
  onFees: (v: number) => void;
  onReset: () => void;
  defaultFees: number;
}) {
  const changed = overridden || floor !== 0 || fees !== defaultFees;
  // Custom minimums snap to the steps the whole site can compute exactly.
  const preset = FLOOR_PRESETS.find((f) => f === floor);
  return (
    <div className="border-y border-ink bg-canvas lg:sticky lg:top-0 lg:z-30">
      <div className="grid gap-x-10 gap-y-5 py-3.5 md:grid-cols-[auto_auto_minmax(200px,1fr)] md:items-end">
        <div>
          <div className="mb-1.5 flex items-center gap-2 font-sans text-[13px] font-bold">
            Box price
            <InfoTip>
              What you&rsquo;d pay for a sealed {packsPerBox}-pack {productName} display. Defaults to TCGplayer&rsquo;s market price;
              type your own to compare.
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
              ) : marketPrice.usd != null ? (
                <>Street-price estimate. Type what you&rsquo;d actually pay.</>
              ) : (
                <>No market price for this box yet. Type what you&rsquo;d pay.</>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2 font-sans text-[13px] font-bold">
            Ignore cards under
            <InfoTip>
              Bulk commons and uncommons are hard to sell one at a time. Anything priced below this counts as zero — a truer
              picture of what you can actually turn into cash. Pick a preset or type an amount (it rounds to the nearest 5¢
              up to $2). This applies on every page, and your browser remembers it.
            </InfoTip>
          </div>
          <div className="flex items-center gap-2">
            <Segmented
              label="Ignore cards priced under"
              value={preset != null ? String(preset) : ""}
              onChange={(v) => onFloor(Number(v))}
              options={FLOOR_PRESETS.map((f) => ({ value: String(f), label: floorLabel(f) }))}
            />
            <FloorInput value={floor} onChange={onFloor} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-2 font-sans text-[13px] font-bold">
            <span className="flex items-center gap-2">
              Selling fees per card
              <InfoTip>
                Marketplace and payment fees come off every card you sell. {defaultFees}% is the default; set 0% to see raw market
                value, or raise it to cover postage. Selling cards on to a store, at the price stores pay for singles (their
                &ldquo;buylist&rdquo;), usually returns about half to two thirds of market value: 35–50% models that. This applies
                on every page, and your browser remembers it.
              </InfoTip>
            </span>
            <span className="font-semibold">
              {fees}% <span className="font-normal text-body">· you keep {Math.round(100 - fees)}¢ of each $1</span>
            </span>
          </div>
          <div className="flex h-11 items-center gap-4">
            <Slider aria-label="Selling fees in percent" min={0} max={MAX_FEES} step={1} value={[fees]} onValueChange={([v]) => onFees(v)} />
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
