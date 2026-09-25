import { Link, useRoute } from "wouter";
import { useSnapshotIndex } from "@/hooks/useSnapshotIndex";
import { ratio } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CATALOG } from "@/sets/catalog";

/** One line per set, like a stock ticker: code, price-to-value ratio, and which side of 1.00× it's on. */
export function MarketStrip() {
  const { index } = useSnapshotIndex();
  const [, params] = useRoute("/sets/:code");
  const byCode = new Map(index?.sets.map((s) => [s.code, s]));

  return (
    <nav aria-label="All sets" className="border-b border-hairline">
      <ul className="mx-auto flex max-w-page overflow-x-auto px-4 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {CATALOG.map((entry) => {
          const s = byCode.get(entry.code);
          const r = s?.ratio ?? null;
          const active = params?.code === entry.code;
          return (
            <li key={entry.code} className="shrink-0">
              <Link
                href={`/sets/${entry.code}`}
                className={cn(
                  "flex h-10 items-center gap-2 border-r border-hairline px-3 font-mono text-[12px] first:pl-0 hover:bg-canvas-soft",
                  active && "bg-ink text-canvas hover:bg-ink",
                )}
                title={`${entry.name}${r != null ? `: box costs ${ratio(r)} its expected value` : ""}`}
              >
                <span className="font-medium uppercase">{entry.code}</span>
                <span className="num">{ratio(r)}</span>
                {r != null && (
                  <span
                    aria-hidden="true"
                    className={cn("size-1.5", r <= 1 ? "bg-accent" : "bg-keep", active && "outline outline-canvas")}
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
