import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { RatioMeter } from "@/components/charts/Bars";
import { SetIcon } from "@/components/SetIcon";
import { Masthead } from "@/components/site/Masthead";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useSnapshotIndex } from "@/hooks/useSnapshotIndex";
import { BOOSTER_SHORT } from "@/lib/boosters";
import { date, isReleased, money, monthYear, percent, ratio } from "@/lib/format";
import type { BoosterSummary, BoosterType, SetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { settingsPhrase, VERDICT_TITLE, verdictFor } from "@/lib/verdict";
import { CATALOG, type CatalogEntry } from "@/sets/catalog";

function headline(s: SetSummary, b: BoosterSummary): string {
  const v = verdictFor(b.ratio, s.releasedAt);
  if (v === "early") return `${s.name}: too early to call`;
  if (v === "crack") return `${s.name} boxes are worth opening`;
  if (v === "keep") return `Keep ${s.name} sealed`;
  return `${s.name} is a coin flip`;
}

function LeadStory({ s, b }: { s: SetSummary; b: BoosterSummary }) {
  const released = isReleased(s.releasedAt);
  const price = b.boxPrice.usd;
  return (
    <article className="grid gap-10 border-b-2 border-rule py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16">
      <div className="flex flex-col">
        <p className="kicker text-body">
          {released ? "Newest set" : `Out ${date(s.releasedAt)}`} · {b.name} display
        </p>
        <h1 className="display mt-4 text-[clamp(46px,7vw,92px)] leading-[0.92]">{headline(s, b)}</h1>
        <p className="mt-6 max-w-2xl font-serif text-[19px] leading-[1.55] text-ink-soft sm:text-[21px]">
          A {b.packsPerBox}-pack box costs about {money(price)}. On this morning&rsquo;s prices the cards inside average{" "}
          {money(b.evBox)} {settingsPhrase(s.params)}, so every dollar spent buys {money(price ? b.evBox / price : null)} of cards.
          {!released &&
            " The set isn’t out yet, and preorder singles prices rest on a handful of early sales. They nearly always fall after launch, so treat this as a ceiling."}
        </p>

        <dl className="mt-10 grid grid-cols-3 border-t border-ink">
          {[
            ["Box price", money(price)],
            ["Expected value", money(b.evBox)],
            ["Price ÷ value", ratio(b.ratio)],
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

      {b.topCard && (
        <figure className="self-end">
          {b.topCard.image && (
            <Link href={`/sets/${s.code}#chase`} className="group relative block overflow-hidden rounded-[4.6%/3.3%] bg-card-back">
              <img src={b.topCard.image} alt={b.topCard.name} className="aspect-[488/680] w-full object-cover" />
              {b.topCard.foil && <div className="foil-sheen" aria-hidden="true" />}
            </Link>
          )}
          <figcaption className="mt-4 border-t border-ink pt-3">
            <span className="kicker text-body">The chase</span>
            <span className="mt-1 block font-sans text-[17px] font-bold">{b.topCard.name}</span>
            <span className="text-[14px] text-body">
              {[b.topCard.treatmentLabel !== "Regular" ? b.topCard.treatmentLabel : null, b.topCard.foil ? "foil" : null]
                .filter(Boolean)
                .join(", ") || "Regular"}{" "}
              · {money(b.topCard.price)}
            </span>
          </figcaption>
        </figure>
      )}
    </article>
  );
}

type SortKey = "release" | "ratio" | "ev" | "price";

/** Which box the board compares: each set's main booster, or its Set or Collector Boosters. */
type BoardView = "main" | "set" | "collector";

const VIEWS: { value: BoardView; label: string; note: string }[] = [
  {
    value: "main",
    label: "Play / Draft",
    note: "Each set's main booster box: Play Boosters from Murders at Karlov Manor (2024) on, Draft Boosters before that.",
  },
  { value: "set", label: "Set", note: "Set Boosters, sold from Zendikar Rising (2020) to The Lost Caverns of Ixalan (2023), 30 to a box." },
  { value: "collector", label: "Collector", note: "Collector Boosters, 12 to a box: fewer, pricier packs built around foils and alternate art." },
];

interface Row {
  entry: CatalogEntry;
  s: SetSummary | null;
  b: BoosterSummary | null;
  type: BoosterType;
  href: string;
}

/** The board's rows for a view: sets that sold that booster, newest first. */
function boardRows(sets: SetSummary[], view: BoardView): Row[] {
  const byCode = new Map(sets.map((s) => [s.code, s]));
  return CATALOG.flatMap((entry) => {
    const main = entry.boosters[0].type;
    const type = view === "main" ? main : view;
    if (!entry.boosters.some((b) => b.type === type)) return [];
    const s = byCode.get(entry.code) ?? null;
    const b = s?.boosters.find((x) => x.type === type) ?? null;
    return [{ entry, s, b, type, href: `/sets/${entry.code}${type === main ? "" : `/${type}`}` }];
  });
}

function Board({ rows: all, view }: { rows: Row[]; view: BoardView }) {
  const [sort, setSort] = useState<SortKey>("release");
  const [, navigate] = useLocation();
  const rows = useMemo(() => {
    const key = (r: Row) => {
      if (!r.b) return -Infinity;
      if (sort === "ratio") return -(r.b.ratio ?? Infinity);
      if (sort === "ev") return r.b.evBox;
      if (sort === "price") return r.b.boxPrice.usd ?? 0;
      return 0;
    };
    return sort === "release" ? all : [...all].sort((a, b) => key(b) - key(a));
  }, [all, sort]);

  const th = (k: SortKey, label: string, cls = "") => (
    <th scope="col" className={cn("py-2 font-semibold", cls)} aria-sort={sort === k ? "descending" : "none"}>
      <button type="button" onClick={() => setSort(k)} className={cn("hover:text-ink", sort === k && "text-ink underline underline-offset-4")}>
        {label}
      </button>
    </th>
  );

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left md:min-w-[820px]">
        <caption className="sr-only">Every tracked set: box price, expected value, and price-to-value ratio</caption>
        <thead>
          <tr className="border-b border-ink text-[12px] text-body">
            {th("release", "Set", "pr-4")}
            <th scope="col" className="hidden py-2 pr-4 font-semibold lg:table-cell">Released</th>
            {th("price", "Box", "hidden pr-4 text-right md:table-cell")}
            {th("ev", "Expected value", "hidden pr-6 text-right whitespace-nowrap md:table-cell")}
            {th("ratio", "Price ÷ value", "w-[36%] pr-4 md:w-[22%] md:pr-6")}
            <th scope="col" className="hidden py-2 pr-4 font-semibold sm:table-cell">Verdict</th>
            <th scope="col" className="hidden py-2 font-semibold lg:table-cell">Top card</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entry, s, b, type, href }) => {
            const v = verdictFor(b?.ratio ?? null, s?.releasedAt);
            return (
              <tr key={entry.code} className="group cursor-pointer border-b border-hairline hover:bg-canvas-soft" onClick={() => navigate(href)}>
                <th scope="row" className="py-3.5 pr-4 font-normal">
                  <Link href={href} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <span className="flex w-6 shrink-0 justify-center">
                      <SetIcon src={s?.iconSvg ?? null} className="h-5 w-auto max-w-6" />
                    </span>
                    <span className="font-sans text-[16px] font-bold group-hover:underline group-hover:underline-offset-4">
                      {s?.name ?? entry.name}
                    </span>
                    <span className="kicker hidden text-muted sm:inline">{entry.code}</span>
                  </Link>
                </th>
                <td className="num hidden py-3.5 pr-4 text-[14px] whitespace-nowrap text-body lg:table-cell">
                  {monthYear(s?.releasedAt ?? entry.releasedAt)}
                </td>
                <td className="num hidden py-3.5 pr-4 text-right text-[15px] whitespace-nowrap md:table-cell">
                  {money(b?.boxPrice.usd)}
                  {b?.boxPrice.source === "estimate" && b.boxPrice.usd != null && (
                    <span className="ml-0.5 text-muted" title="Estimated street price">
                      *
                    </span>
                  )}
                  {view === "main" && b && (
                    <span className="block font-sans text-[11.5px] text-muted">
                      {b.packsPerBox} × {BOOSTER_SHORT[type]}
                    </span>
                  )}
                </td>
                <td className="num hidden py-3.5 pr-6 text-right text-[15px] font-semibold whitespace-nowrap md:table-cell">
                  {b ? money(b.evBox) : "—"}
                </td>
                <td className="py-3.5 pr-4 md:pr-6">
                  <div className="flex items-center gap-3">
                    <span className="num w-12 shrink-0 text-[15px] font-semibold">{ratio(b?.ratio)}</span>
                    <RatioMeter value={b?.ratio ?? null} />
                  </div>
                </td>
                <td className="hidden py-3.5 pr-4 text-[14px] font-semibold sm:table-cell">
                  {v ? VERDICT_TITLE[v] : <span className="font-normal text-muted">{b ? "No box price" : "No data"}</span>}
                </td>
                <td className="hidden max-w-56 py-3.5 text-[14px] lg:table-cell">
                  {b?.topCard ? (
                    <span className="block truncate">
                      {b.topCard.name} <span className="num text-body">{money(b.topCard.price)}</span>
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

function isView(v: string | null): v is BoardView {
  return VIEWS.some((x) => x.value === v);
}

export function HomePage() {
  const { status, index } = useSnapshotIndex();
  const [, navigate] = useLocation();
  const requested = new URLSearchParams(useSearch()).get("booster");
  const view: BoardView = isView(requested) ? requested : "main";
  useEffect(() => {
    document.title = "Crack or Keep — What a Magic booster box is worth once you open it";
  }, []);

  const sets = index?.sets ?? [];
  const lead = sets.find((s) => (s.boosters[0]?.evBox ?? 0) > 0) ?? null;
  const rows = useMemo(() => boardRows(sets, view), [sets, view]);
  // Preorder prices would win this every time; only count sets that are out.
  const best = rows
    .filter((r): r is Row & { s: SetSummary; b: BoosterSummary & { ratio: number } } => r.b?.ratio != null && isReleased(r.s!.releasedAt))
    .sort((a, b) => a.b.ratio - b.b.ratio)[0];

  return (
    <>
      <Masthead />
      <main className="mx-auto max-w-page px-4 sm:px-6">
        {lead ? (
          <LeadStory s={lead} b={lead.boosters[0]} />
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
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b-2 border-rule pb-3">
            <div>
              <p className="kicker text-body">The board</p>
              <h2 id="board-title" className="display mt-1 text-[40px] leading-none sm:text-[52px]">
                Every booster box, priced
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="kicker text-body">Booster</span>
              <Segmented
                label="Which booster box to compare"
                value={view}
                onChange={(v) => navigate(v === "main" ? "/" : `/?booster=${v}`, { replace: true })}
                options={VIEWS.map(({ value, label }) => ({ value, label }))}
              />
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-x-10 gap-y-2 pt-3 pb-1 text-[14px] text-body">
            <p className="max-w-xl">{VIEWS.find((v) => v.value === view)!.note}</p>
            {best && (
              <p className="max-w-sm">
                Best value right now: <strong className="text-ink">{best.s.name}</strong>, at {ratio(best.b.ratio)} —{" "}
                {percent(1 / best.b.ratio)} of the box price back in cards.
              </p>
            )}
          </div>
          <Board rows={rows} view={view} />
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
