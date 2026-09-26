import { Popover } from "radix-ui";
import { FLOOR_PRESETS, FloorInput, floorLabel } from "@/components/set/Controls";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { DEFAULT_SETTINGS, isDefault, MAX_FEES, toParams, useSettings } from "@/lib/settings";
import { settingsPhrase } from "@/lib/verdict";

/**
 * The site-wide settings, reachable from every page: which cards are too cheap to count
 * and what selling costs. Every value on the site follows them.
 */
export function SettingsMenu() {
  const [settings, update] = useSettings();
  const preset = FLOOR_PRESETS.find((f) => f === settings.floor);
  return (
    <Popover.Root>
      <Popover.Trigger className="group relative inline-flex items-center gap-1 font-sans text-[14px] font-bold tracking-[0.02em] outline-none">
        Settings
        {!isDefault(settings) && <span aria-label="changed from the defaults" className="size-1.5 bg-accent" />}
        <svg viewBox="0 0 10 6" className="h-1.5 w-2.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={12}
          className="z-50 w-[min(24rem,calc(100vw-2rem))] border border-ink bg-canvas p-5 text-ink outline-none"
        >
          <p className="kicker text-body">Your settings</p>
          <p className="mt-2 text-[14px] leading-snug text-body">
            How every value on the site is counted: now {settingsPhrase(toParams(settings))}. Your browser remembers these.
          </p>

          <div className="mt-5 font-sans text-[13px] font-bold">Ignore cards under</div>
          <p className="mt-1 text-[12.5px] text-body">Cheaper cards count as nothing: bulk that is hard to sell one at a time.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Segmented
              label="Ignore cards priced under"
              value={preset != null ? String(preset) : ""}
              onChange={(v) => update({ floor: Number(v) })}
              options={FLOOR_PRESETS.map((f) => ({ value: String(f), label: floorLabel(f) }))}
            />
            <FloorInput value={settings.floor} onChange={(v) => update({ floor: v })} />
          </div>

          <div className="mt-5 flex items-baseline justify-between gap-3 font-sans text-[13px] font-bold">
            Selling fees per card
            <span className="font-semibold">
              {settings.fees}% <span className="font-normal text-body">· you keep {100 - settings.fees}¢ of each $1</span>
            </span>
          </div>
          <p className="mt-1 text-[12.5px] text-body">
            Marketplace fees and postage. Selling on to a store at its buylist price returns about half to two thirds:{" "}
            <span className="whitespace-nowrap">35–50%</span>.
          </p>
          <div className="mt-2 flex h-10 items-center">
            <Slider aria-label="Selling fees in percent" min={0} max={MAX_FEES} step={1} value={[settings.fees]} onValueChange={([v]) => update({ fees: v })} />
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-hairline pt-3 text-[13px]">
            <span className="text-body">Defaults: every card counts, {DEFAULT_SETTINGS.fees}% fees.</span>
            {!isDefault(settings) && (
              <button type="button" onClick={() => update(DEFAULT_SETTINGS)} className="kicker text-ink underline underline-offset-4">
                Reset
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
