import { useMemo, useState } from "react";
import { CardImage } from "@/components/CardImage";
import { Segmented } from "@/components/ui/segmented";
import type { CardStat } from "@/lib/engine/ev";
import { money, oneIn, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

type Order = "impact" | "price";

export function finishLabel(stat: Pick<CardStat, "foil" | "card">): string {
  const parts = stat.card.treatmentLabel !== "Regular" ? [stat.card.treatmentLabel] : [];
  if (stat.foil) parts.push(stat.card.foilLabel ?? "Foil");
  return parts.join(" · ") || "Regular";
}

export function ChaseGrid({ cards, packs }: { cards: CardStat[]; packs: number }) {
  const [order, setOrder] = useState<Order>("impact");
  const top = useMemo(() => {
    const priced = cards.filter((c) => c.price != null && c.perPack > 0);
    const sorted = order === "impact" ? priced : [...priced].sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    return sorted.slice(0, 9);
  }, [cards, order]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[14px] text-body">
          {order === "impact"
            ? "Ranked by what each card adds to the average box: price × how often it turns up."
            : "Ranked by market price alone. Most of these turn up far less often than once a box."}
        </p>
        <Segmented
          label="Rank the chase cards by"
          value={order}
          onChange={setOrder}
          options={[
            { value: "impact", label: "Value to the box" },
            { value: "price", label: "Price" },
          ]}
        />
      </div>

      <ol className="grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3 lg:grid-cols-6">
        {top.map((c, i) => (
          <li
            key={c.key}
            className={cn("group min-w-0", i === 0 && "col-span-2 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 sm:row-span-2 sm:block lg:col-span-2")}
          >
            <a
              href={c.card.scryfallUri ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="block outline-none"
              aria-label={`${c.card.name}, ${finishLabel(c)}, ${money(c.price)}`}
            >
              <CardImage
                card={c.card}
                foil={c.foil}
                eager={i < 3}
                className={cn("transition-transform duration-300 group-hover:-translate-y-1", i === 0 && "sm:max-w-[420px]")}
              />
            </a>
            <div className={cn("mt-3", i === 0 && "mt-0 sm:mt-4")}>
              <div className="kicker text-body">{String(i + 1).padStart(2, "0")}</div>
              <div className={cn("mt-1 font-sans font-bold leading-tight", i === 0 ? "text-[22px]" : "text-[15px]")}>{c.card.name}</div>
              <div className="mt-0.5 text-[13px] text-body">{finishLabel(c)}</div>
              <div className={cn("mt-2 font-sans font-semibold tracking-[-0.01em]", i === 0 ? "text-[30px]" : "text-[20px]")}>{money(c.price)}</div>
              <dl className="mt-1.5 space-y-0.5 text-[12.5px] leading-snug text-body">
                <div>
                  <dt className="sr-only">Odds</dt>
                  <dd>{oneIn(c.perPack)}</dd>
                </div>
                <div>
                  <dt className="sr-only">Chance in a box</dt>
                  <dd>In {percent(c.chanceInBox, c.chanceInBox < 0.1 ? 1 : 0)} of boxes</dd>
                </div>
                <div>
                  <dt className="sr-only">Adds to each box</dt>
                  <dd>
                    Adds <span className="font-semibold text-ink">{money(c.evBox)}</span> a box
                  </dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-[13px] text-body">
        Odds are per pack; “of boxes” is the chance of at least one copy in a {packs}-pack box.
      </p>
    </div>
  );
}
