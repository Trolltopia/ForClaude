import { Link } from "wouter";
import { BOOSTER_SHORT } from "@/lib/boosters";
import { money, ratio } from "@/lib/format";
import type { BoosterType } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface BoosterTab {
  type: BoosterType;
  name: string;
  packsPerBox: number;
  /** The box price this booster is priced at: your own for the current one, market for the rest. */
  boxPrice: number | null;
  evBox: number;
  /** Null for a booster the set was sold in that we can't model yet. */
  href: string | null;
}

/** Which booster the page prices. Each tab carries its own price ÷ value, so they compare at a glance. */
export function BoosterTabs({ tabs, current, provisional }: { tabs: BoosterTab[]; current: BoosterType; provisional: boolean }) {
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Booster" className="flex divide-x divide-hairline border-x border-t border-hairline sm:w-fit">
      {tabs.map((t) => {
        const active = t.type === current;
        const r = t.boxPrice && t.evBox > 0 ? t.boxPrice / t.evBox : null;
        if (t.href == null) {
          return (
            <span key={t.type} aria-disabled="true" className="block min-w-0 flex-1 px-3 py-2.5 text-muted sm:w-60 sm:flex-none sm:px-4">
              <span className="block truncate font-sans text-[15px] font-bold">
                <span className="sm:hidden">{BOOSTER_SHORT[t.type]}</span>
                <span className="hidden sm:inline">{t.name}</span>
              </span>
              <span className="mt-0.5 block truncate text-[12.5px]">Not priced yet</span>
            </span>
          );
        }
        return (
          <Link
            key={t.type}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "block min-w-0 flex-1 px-3 py-2.5 sm:w-60 sm:flex-none sm:px-4",
              active ? "bg-ink text-canvas" : "hover:bg-canvas-soft",
            )}
          >
            <span className="block truncate font-sans text-[15px] font-bold">
              <span className="sm:hidden">{BOOSTER_SHORT[t.type]}</span>
              <span className="hidden sm:inline">{t.name}</span>
            </span>
            <span className={cn("num mt-0.5 flex items-center gap-1.5 text-[12.5px]", active ? "opacity-75" : "text-body")}>
              {r != null && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 shrink-0",
                    // Hollow before release, like the market strip: the number is provisional.
                    provisional ? cn("border", r <= 1 ? "border-accent" : "border-keep") : r <= 1 ? "bg-accent" : "bg-keep",
                    active && "outline outline-canvas",
                  )}
                />
              )}
              <span>{ratio(r)}</span>
              <span className="hidden truncate sm:inline">
                · {t.packsPerBox} packs · {money(t.boxPrice, { cents: false })}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
