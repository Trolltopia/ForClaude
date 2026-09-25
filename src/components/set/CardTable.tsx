import { useDeferredValue, useMemo, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { RarityPip, RARITY_LABEL } from "@/components/RarityPip";
import { HoverCard } from "@/components/ui/hover-card";
import { Segmented } from "@/components/ui/segmented";
import type { CardStat } from "@/lib/engine/ev";
import { money, oneIn, percent } from "@/lib/format";
import type { Rarity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { finishLabel } from "./ChaseGrid";

type SortKey = "name" | "price" | "keep" | "odds" | "box" | "impact";
type RarityFilter = "all" | Rarity;
type FinishFilter = "all" | "nonfoil" | "foil";

const PAGE = 60;

function SortHeader({
  label,
  k,
  sort,
  setSort,
  align = "right",
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  setSort: (s: { key: SortKey; dir: 1 | -1 }) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort.key === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
      className={cn("py-2 font-semibold", align === "right" ? "pl-4 text-right" : "pr-4 text-left", className)}
    >
      <button
        type="button"
        onClick={() => setSort({ key: k, dir: active ? (sort.dir === 1 ? -1 : 1) : k === "name" ? 1 : -1 })}
        className={cn("relative inline-flex items-center hover:text-ink", active && "text-ink")}
      >
        {label}
        {active && (
          <span aria-hidden="true" className={cn("absolute top-1/2 -translate-y-1/2 text-[8px]", align === "right" ? "-left-3" : "-right-3")}>
            {sort.dir === 1 ? "▲" : "▼"}
          </span>
        )}
      </button>
    </th>
  );
}

export function CardTable({ cards }: { cards: CardStat[] }) {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<RarityFilter>("all");
  const [finish, setFinish] = useState<FinishFilter>("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "impact", dir: -1 });
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query.trim().toLowerCase());

  const rarities = useMemo(() => {
    const present = new Set(cards.map((c) => c.card.rarity));
    return (["common", "uncommon", "rare", "mythic", "special"] as Rarity[]).filter((r) => present.has(r));
  }, [cards]);

  const rows = useMemo(() => {
    const filtered = cards.filter(
      (c) =>
        c.perPack > 0 &&
        (rarity === "all" || c.card.rarity === rarity) &&
        (finish === "all" || (finish === "foil") === c.foil) &&
        (!q || c.card.name.toLowerCase().includes(q) || c.card.treatmentLabel.toLowerCase().includes(q)),
    );
    const val = (c: CardStat): number | string => {
      switch (sort.key) {
        case "name":
          return c.card.name;
        case "price":
          return c.price ?? -1;
        case "keep":
          return c.value;
        case "odds":
          return c.perPack;
        case "box":
          return c.chanceInBox;
        case "impact":
          return c.evBox;
      }
    };
    return filtered.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "string" ? x.localeCompare(y as string) : x - (y as number)) * sort.dir;
    });
  }, [cards, rarity, finish, q, sort]);

  const shown = rows.slice(0, limit);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <label className="flex h-9 w-full items-center border border-ink bg-canvas px-3 sm:w-72">
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-body" aria-hidden="true">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Find a card or treatment"
            aria-label="Filter cards by name or treatment"
            className="h-full w-full bg-transparent pl-2 text-[14px] outline-none placeholder:text-muted"
          />
        </label>
        <Segmented
          label="Rarity"
          value={rarity}
          onChange={(v) => {
            setRarity(v);
            setLimit(PAGE);
          }}
          options={[{ value: "all", label: "All" }, ...rarities.map((r) => ({ value: r, label: RARITY_LABEL[r] }))]}
        />
        <Segmented
          label="Finish"
          value={finish}
          onChange={(v) => {
            setFinish(v);
            setLimit(PAGE);
          }}
          options={[
            { value: "all", label: "Both" },
            { value: "nonfoil", label: "Non-foil" },
            { value: "foil", label: "Foil" },
          ]}
        />
        <span className="ml-auto text-[13px] text-body" aria-live="polite">
          {rows.length} {rows.length === 1 ? "card" : "cards"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[14px] md:min-w-[840px]">
          <caption className="sr-only">Every card you can open, with price, odds and contribution to box value</caption>
          <thead>
            <tr className="border-b border-ink text-[12px] text-body">
              <SortHeader label="Card" k="name" sort={sort} setSort={setSort} align="left" />
              <th scope="col" className="hidden py-2 pr-4 font-semibold md:table-cell">Version</th>
              <SortHeader label="Price" k="price" sort={sort} setSort={setSort} />
              <SortHeader label="You keep" k="keep" sort={sort} setSort={setSort} className="hidden sm:table-cell" />
              <SortHeader label="Odds" k="odds" sort={sort} setSort={setSort} className="hidden md:table-cell" />
              <SortHeader label="In a box" k="box" sort={sort} setSort={setSort} className="hidden md:table-cell" />
              <SortHeader label="Adds to box" k="impact" sort={sort} setSort={setSort} />
            </tr>
          </thead>
          <tbody>
            {shown.map((c) => (
              <tr key={c.key} className="border-b border-hairline hover:bg-canvas-soft">
                <td className="py-2 pr-4">
                  <HoverCard
                    trigger={
                      <a
                        href={c.card.scryfallUri ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2.5 font-semibold hover:underline hover:underline-offset-2"
                      >
                        <RarityPip rarity={c.card.rarity} />
                        {c.card.name}
                      </a>
                    }
                  >
                    <div className="group w-60">
                      <CardImage card={c.card} foil={c.foil} eager />
                    </div>
                  </HoverCard>
                  <span className="ml-2 hidden font-mono text-[11px] text-muted uppercase sm:inline">
                    {c.card.set} {c.card.cn}
                  </span>
                  <span className="block pl-[18px] text-[12.5px] text-body md:hidden">{finishLabel(c)}</span>
                </td>
                <td className="hidden py-2 pr-4 text-body md:table-cell">{finishLabel(c)}</td>
                <td className="num py-2 pl-4 text-right font-semibold">{money(c.price)}</td>
                <td className="num hidden py-2 pl-4 text-right sm:table-cell">
                  {c.price == null ? (
                    <span className="text-muted">—</span>
                  ) : c.value === 0 ? (
                    <span className="font-sans text-[12.5px] text-muted" title="Under your floor, so it counts as zero">
                      bulk
                    </span>
                  ) : (
                    money(c.value)
                  )}
                </td>
                <td className="hidden py-2 pl-4 text-right whitespace-nowrap text-body md:table-cell">{oneIn(c.perPack)}</td>
                <td className="num hidden py-2 pl-4 text-right text-body md:table-cell">{percent(c.chanceInBox, c.chanceInBox < 0.1 ? 1 : 0)}</td>
                <td className="num py-2 pl-4 text-right">{money(c.evBox)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit(rows.length)}
            className="h-10 border border-ink px-5 text-[14px] font-bold hover:bg-ink hover:text-canvas"
          >
            Show all {rows.length} cards
          </button>
        </div>
      )}
    </div>
  );
}
