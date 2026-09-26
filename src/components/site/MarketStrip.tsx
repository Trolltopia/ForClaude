import { Link, useRoute } from "wouter";
import { useSnapshotIndex } from "@/hooks/useSnapshotIndex";
import { isReleased, signedPercent } from "@/lib/format";
import { useSettings } from "@/lib/settings";
import { boosterAt } from "@/lib/summary";
import { cn } from "@/lib/utils";
import { CATALOG } from "@/sets/catalog";

/** The strip follows the market now: the newest sets. The board has the rest. */
const RECENT = CATALOG.slice(0, 20);

/** One line per set, like a stock ticker: code, return at your settings, and which side of break-even it's on. */
export function MarketStrip() {
  const { index } = useSnapshotIndex();
  const [settings] = useSettings();
  const [, params] = useRoute("/sets/:code/:booster?");
  const byCode = new Map(index?.sets.map((s) => [s.code, s]));

  return (
    <nav aria-label="All sets" className="border-b border-hairline">
      <ul className="mx-auto flex max-w-page overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {RECENT.map((entry) => {
          const s = byCode.get(entry.code);
          // Each set's main booster: Play, or Draft before 2024.
          const main = s?.boosters[0];
          const r = s && main ? boosterAt(main, s, settings).ret : null;
          const active = params?.code === entry.code;
          return (
            <li key={entry.code} className="shrink-0">
              <Link
                href={`/sets/${entry.code}`}
                className={cn(
                  "flex h-10 items-center gap-2 border-r border-hairline px-3 font-mono text-[12px] first:pl-0 hover:bg-canvas-soft",
                  active && "bg-ink text-canvas hover:bg-ink",
                )}
                title={`${entry.name}${r != null ? `: the cards return ${signedPercent(r)} on the box price` : ""}${isReleased(entry.releasedAt) ? "" : " (preorder prices)"}`}
              >
                <span className="font-medium uppercase">{entry.code}</span>
                <span className="num">{signedPercent(r)}</span>
                {r != null && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "size-1.5",
                      // Hollow while the set is still on preorder: the number is provisional.
                      isReleased(entry.releasedAt)
                        ? r >= 0
                          ? "bg-accent"
                          : "bg-keep"
                        : cn("border", r >= 0 ? "border-accent" : "border-keep"),
                      active && "outline outline-canvas",
                    )}
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
