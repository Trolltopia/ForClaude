import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { RatioMeter } from "@/components/charts/Bars";
import { SetIcon } from "@/components/SetIcon";
import { Masthead } from "@/components/site/Masthead";
import { Button } from "@/components/ui/button";
import { useSnapshotIndex } from "@/hooks/useSnapshotIndex";
import { date, isReleased, money, monthYear, percent, ratio } from "@/lib/format";
import type { SetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { settingsPhrase, VERDICT_TITLE, verdictFor } from "@/lib/verdict";
import { CATALOG } from "@/sets/catalog";

function headline(s: SetSummary): string {
  const v = verdictFor(s.ratio, s.releasedAt);
  if (v === "early") return `${s.name}: too early to call`;
  if (v === "crack") return `${s.name} boxes are worth opening`;
  if (v === "keep") return `Keep ${s.name} sealed`;
  return `${s.name} is a coin flip`;
}

function LeadStory({ s }: { s: SetSummary }) {
  const released = isReleased(s.releasedAt);
  const price = s.boxPrice.usd;
  return (
    <article className="grid gap-10 border-b-2 border-rule py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16">
      <div className="flex flex-col">
        <p className="kicker text-body">
          {released ? "Newest set" : `Out ${date(s.releasedAt)}`} · Play Booster display
        </p>
        <h1 className="display mt-4 text-[clamp(46px,7vw,92px)] leading-[0.92]">{headline(s)}</h1>
        <p className="mt-6 max-w-2xl font-serif text-[19px] leading-[1.55] text-ink-soft sm:text-[21px]">
          A {s.packsPerBox}-pack box costs about {money(price)}. On this morning&rsquo;s prices the cards inside average{" "}
          {money(s.evBox)} {settingsPhrase(s.params ?? { floor: 0, fees: 0 })}, so every dollar spent buys{" "}
          {money(price ? s.evBox / price : null)} of cards.
          {!released &&
            " The set isn’t out yet, and preorder singles prices rest on a handful of early sales. They nearly always fall after launch, so treat this as a ceiling."}
        </p>

        <dl className="mt-10 grid grid-cols-3 border-t border-ink">
          {[
            ["Box price", money(price)],
            ["Expected value", money(s.evBox)],
            ["Price ÷ value", ratio(s.ratio)],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-hairline pt-3 pr-3 last:border-r-0 [&:not(:first-child)]:pl-4">
              <dt className="text-[12px] font-bold sm:text-[13px]">{label}</dt>
              <dd className="mt-1 font-sans text-[26px] font-semibold tracking-[-0.02em] sm:text-[40px]">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <Button asChild>
            <Link href={`/sets/${s.code}`}>Open the {s.name} calculator →</Link>
          </Button>
        </div>
      </div>

      {s.topCard && (
        <figure className="self-end">
          {s.topCard.image && (
            <Link href={`/sets/${s.code}#chase`} className="group relative block overflow-hidden rounded-[4.6%/3.3%] bg-card-back">
              <img src={s.topCard.image} alt={s.topCard.name} className="aspect-[488/680] w-full object-cover" />
              {s.topCard.foil && <div className="foil-sheen" aria-hidden="true" />}
            </Link>
          )}
          <figcaption className="mt-4 border-t border-ink pt-3">
            <span className="kicker text-body">The chase</span>
            <span className="mt-1 block font-sans text-[17px] font-bold">{s.topCard.name}</span>
            <span className="text-[14px] text-body">
              {[s.topCard.treatmentLabel !== "Regular" ? s.topCard.treatmentLabel : null, s.topCard.foil ? "foil" : null]
                .filter(Boolean)
                .join(", ") || "Regular"}{" "}
              · {money(s.topCard.price)}
            </span>
          </figcaption>
        </figure>
      )}
    </article>
  );
}

type SortKey = "release" | "ratio" | "ev" | "price";

function Board({ sets }: { sets: SetSummary[] }) {
  const [sort, setSort] = useState<SortKey>("release");
  const [, navigate] = useLocation();
  const rows = useMemo(() => {
    const byCode = new Map(sets.map((s) => [s.code, s]));
    const all = CATALOG.map((c) => ({ entry: c, s: byCode.get(c.code) ?? null }));
    const key = (r: (typeof all)[number]) => {
      if (!r.s) return -Infinity;
      if (sort === "ratio") return -(r.s.ratio ?? Infinity);
      if (sort === "ev") return r.s.evBox;
      if (sort === "price") return r.s.boxPrice.usd ?? 0;
      return 0;
    };
    return sort === "release" ? all : [...all].sort((a, b) => key(b) - key(a));
  }, [sets, sort]);

  const th = (k: SortKey, label: string, cls = "") => (
    <th scope="col" className={cn("py-2 font-semibold", cls)} aria-sort={sort === k ? "descending" : "none"}>
      <button type="button" onClick={() => setSort(k)} className={cn("hover:text-ink", sort === k && "text-ink underline underline-offset-4")}>
        {label}
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left md:min-w-[820px]">
        <caption className="sr-only">Every tracked set: box price, expected value, and price-to-value ratio</caption>
        <thead>
          <tr className="border-b border-ink text-[12px] text-body">
            {th("release", "Set", "pr-4")}
            <th scope="col" className="hidden py-2 pr-4 font-semibold lg:table-cell">Released</th>
            {th("price", "Box", "hidden pr-4 text-right md:table-cell")}
            {th("ev", "Expected value", "hidden pr-6 text-right md:table-cell")}
            {th("ratio", "Price ÷ value", "w-[36%] pr-4 md:w-[22%] md:pr-6")}
            <th scope="col" className="hidden py-2 pr-4 font-semibold sm:table-cell">Verdict</th>
            <th scope="col" className="hidden py-2 font-semibold lg:table-cell">Top card</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, s }) => {
            const v = verdictFor(s?.ratio ?? null, s?.releasedAt);
            return (
              <tr
                key={entry.code}
                className="group cursor-pointer border-b border-hairline hover:bg-canvas-soft"
                onClick={() => navigate(`/sets/${entry.code}`)}
              >
                <th scope="row" className="py-3.5 pr-4 font-normal">
                  <Link href={`/sets/${entry.code}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <span className="flex w-6 justify-center">
                      <SetIcon src={s?.iconSvg ?? null} className="h-5 w-auto max-w-6" />
                    </span>
                    <span className="font-sans text-[16px] font-bold group-hover:underline group-hover:underline-offset-4">
                      {s?.name ?? entry.name}
                    </span>
                    <span className="kicker hidden text-muted sm:inline">{entry.code}</span>
                  </Link>
                </th>
                <td className="num hidden py-3.5 pr-4 text-[14px] text-body lg:table-cell">{monthYear(s?.releasedAt ?? entry.releasedAt)}</td>
                <td className="num hidden py-3.5 pr-4 text-right text-[15px] md:table-cell">
                  {money(s?.boxPrice.usd)}
                  {s?.boxPrice.source === "estimate" && <span className="ml-0.5 text-muted" title="Estimated street price">*</span>}
                </td>
                <td className="num hidden py-3.5 pr-6 text-right text-[15px] font-semibold md:table-cell">{s ? money(s.evBox) : "—"}</td>
                <td className="py-3.5 pr-4 md:pr-6">
                  <div className="flex items-center gap-3">
                    <span className="num w-12 shrink-0 text-[15px] font-semibold">{ratio(s?.ratio)}</span>
                    <RatioMeter value={s?.ratio ?? null} />
                  </div>
                </td>
                <td className="hidden py-3.5 pr-4 text-[14px] font-semibold sm:table-cell">{v ? VERDICT_TITLE[v] : <span className="font-normal text-muted">No data</span>}</td>
                <td className="hidden max-w-56 py-3.5 text-[14px] lg:table-cell">
                  {s?.topCard ? (
                    <span className="block truncate">
                      {s.topCard.name} <span className="num text-body">{money(s.topCard.price)}</span>
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HowToRead() {
  return (
    <div className="grid gap-8 border-t border-hairline pt-8 md:grid-cols-3">
      {[
        [
          "Expected value",
          "Add up every card you could open, each weighted by how often it turns up, at today’s TCGplayer market price less 8% selling fees. It’s what an average box is worth — not what yours will be.",
        ],
        [
          "Price ÷ value",
          "The box price divided by expected value. Below 1.00× the cards are worth more than the box; above it you’re paying a premium for the thrill. Blue left of centre, red right of it.",
        ],
        [
          "Crack or keep",
          "Within 5% of 1.00× we call it a toss-up. Otherwise, crack a box whose cards are worth more than it costs, and leave the rest sealed — or don’t buy them at all.",
        ],
      ].map(([title, body]) => (
        <div key={title}>
          <h3 className="font-sans text-[15px] font-bold">{title}</h3>
          <p className="mt-2 font-serif text-[16px] leading-relaxed text-ink-soft">{body}</p>
        </div>
      ))}
    </div>
  );
}

export function HomePage() {
  const { status, index } = useSnapshotIndex();
  useEffect(() => {
    document.title = "Crack or Keep — What a Magic booster box is worth once you open it";
  }, []);

  const lead = index?.sets.find((s) => s.evBox > 0) ?? null;
  // Preorder prices would win this every time; only count sets that are out.
  const priced = index?.sets.filter((s) => s.ratio != null && isReleased(s.releasedAt)) ?? [];
  const best = [...priced].sort((a, b) => (a.ratio ?? 9) - (b.ratio ?? 9))[0];

  return (
    <>
      <Masthead />
      <main className="mx-auto max-w-page px-4 sm:px-6">
        {lead ? (
          <LeadStory s={lead} />
        ) : (
          status === "ready" && (
            <div className="border-b-2 border-rule py-12">
              <p className="kicker text-body">No snapshot yet</p>
              <h1 className="display mt-4 max-w-4xl text-[clamp(40px,6vw,76px)] leading-[0.95]">
                Prices haven&rsquo;t been collected on this copy of the site.
              </h1>
              <p className="mt-6 max-w-2xl font-serif text-[19px] leading-relaxed text-ink-soft">
                The daily job writes a snapshot for every set. Running locally? Try{" "}
                <code className="bg-canvas-soft px-1.5 font-mono text-[16px]">npm run data</code>, or open{" "}
                <Link className="prose-link" href="/sets/fra">
                  Reality Fracture
                </Link>
                , which your browser can price straight from Scryfall.
              </p>
            </div>
          )
        )}

        <section className="mt-14" aria-labelledby="board-title">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-rule pb-3">
            <div>
              <p className="kicker text-body">The board</p>
              <h2 id="board-title" className="display mt-1 text-[40px] leading-none sm:text-[52px]">
                Every Play Booster set, priced
              </h2>
            </div>
            {best && (
              <p className="max-w-sm text-[14px] text-body">
                Best value right now: <strong className="text-ink">{best.name}</strong>, at {ratio(best.ratio)} — {percent(1 / (best.ratio ?? 1))} of the box
                price back in cards.
              </p>
            )}
          </div>
          <Board sets={index?.sets ?? []} />
          <p className="mt-3 text-[12px] text-body">
            Expected value is after 8% selling fees per card; open a set to change that or to ignore bulk. Click a column heading to
            sort. * Estimated street price: TCGplayer had no market price for the box.
          </p>
        </section>

        <section className="mt-16" aria-label="How to read the board">
          <HowToRead />
        </section>
      </main>
    </>
  );
}
