import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ReturnMeter } from "@/components/charts/Bars";
import { SetIcon } from "@/components/SetIcon";
import { Masthead } from "@/components/site/Masthead";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { useSnapshotIndex } from "@/hooks/useSnapshotIndex";
import { shortBoosterName } from "@/lib/boosters";
import { ERAS, type Era } from "@/lib/eras";
import { date, isReleased, money, monthYear, signedPercent } from "@/lib/format";
import { toParams, useSettings, type Settings } from "@/lib/settings";
import { boosterAt } from "@/lib/summary";
import type { BoosterSummary, BoosterType, SetSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { settingsPhrase, VERDICT_TITLE, verdictFor } from "@/lib/verdict";
import { CATALOG, type CatalogEntry } from "@/sets/catalog";

/** A booster's value and return at the reader's settings. */
interface At {
  evBox: number;
  ret: number | null;
}

function headline(s: SetSummary, at: At): string {
  const v = verdictFor(at.ret, s.releasedAt);
  if (v === "early") return `${s.name}: too early to call`;
  if (v === "crack") return `${s.name} boxes are worth opening`;
  if (v === "keep") return `Keep ${s.name} sealed`;
  return `${s.name} is a coin flip`;
}

function LeadStory({ s, b, at, settings }: { s: SetSummary; b: BoosterSummary; at: At; settings: Settings }) {
  const released = isReleased(s.releasedAt);
  const price = b.boxPrice.usd;
  return (
    <article className="grid gap-10 border-b-2 border-rule py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16">
      <div className="flex flex-col">
        <p className="kicker text-body">
          {released ? "Newest set" : `Out ${date(s.releasedAt)}`} · {b.name} display
        </p>
        <h1 className="display mt-4 text-[clamp(46px,7vw,92px)] leading-[0.92]">{headline(s, at)}</h1>
        <p className="mt-6 max-w-2xl font-serif text-[19px] leading-[1.55] text-ink-soft sm:text-[21px]">
          A {b.packsPerBox}-pack box costs about {money(price)}. On this morning&rsquo;s prices the cards inside average{" "}
          {money(at.evBox)} {settingsPhrase(toParams(settings))}, so every dollar spent buys {money(price ? at.evBox / price : null)} of
          cards.
          {!released &&
            " The set isn’t out yet, and preorder singles prices rest on a handful of early sales. They nearly always fall after launch, so treat this as a ceiling."}
        </p>

        <dl className="mt-10 grid grid-cols-3 border-t border-ink">
          {[
            ["Box price", money(price)],
            ["Expected value", money(at.evBox)],
            ["Return", signedPercent(at.ret)],
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

/** Newest first by default; the Set heading sorts A to Z. */
type SortKey = "release" | "name" | "return" | "ev" | "price";

/** Which box the board compares: each set's main booster, or its Set or Collector Boosters. */
type BoardView = "main" | "set" | "collector";

const VIEWS: { value: BoardView; label: string; note: string }[] = [
  {
    value: "main",
    label: "Main booster",
    note: "Each set's main booster box: Play Boosters from 2024, Draft Boosters from late 2020 to 2023, and plain boosters before that.",
  },
  { value: "set", label: "Set", note: "Set Boosters, sold from Zendikar Rising (2020) to The Lost Caverns of Ixalan (2023)." },
  { value: "collector", label: "Collector", note: "Collector Boosters, sold since Throne of Eldraine (2019): fewer, pricier packs built around foils and alternate art." },
];

interface Row {
  entry: CatalogEntry;
  s: SetSummary | null;
  b: BoosterSummary | null;
  at: At | null;
  type: BoosterType;
  href: string;
}

/** The board's rows: sets that sold the chosen booster, in the chosen years, matching the search. */
function boardRows(sets: SetSummary[], view: BoardView, era: Era | null, search: string, settings: Settings): Row[] {
  const byCode = new Map(sets.map((s) => [s.code, s]));
  const needle = search.trim().toLowerCase();
  return CATALOG.flatMap((entry) => {
    if (era && (entry.releasedAt < era.from || entry.releasedAt > era.to)) return [];
    if (needle && !entry.name.toLowerCase().includes(needle) && entry.code !== needle) return [];
    const main = entry.boosters[0].type;
    const type = view === "main" ? main : view;
    if (!entry.boosters.some((b) => b.type === type)) return [];
    const s = byCode.get(entry.code) ?? null;
    const b = s?.boosters.find((x) => x.type === type) ?? null;
    const at = s && b ? boosterAt(b, s, settings) : null;
    return [{ entry, s, b, at, type, href: `/sets/${entry.code}${type === main ? "" : `/${type}`}` }];
  });
}

function Board({ rows: all, view }: { rows: Row[]; view: BoardView }) {
  const [sort, setSort] = useState<SortKey>("release");
  const [, navigate] = useLocation();
  const rows = useMemo(() => {
    if (sort === "release") return all;
    if (sort === "name") return [...all].sort((a, b) => a.entry.name.localeCompare(b.entry.name));
    const key = (r: Row) => {
      if (!r.b || !r.at) return -Infinity;
      if (sort === "return") return r.at.ret ?? -Infinity;
      if (sort === "ev") return r.at.evBox;
      return r.b.boxPrice.usd ?? -Infinity;
    };
    return [...all].sort((a, b) => key(b) - key(a));
  }, [all, sort]);
  // Newest first, a heading for each year; other sorts are one flat list.
  const groups = useMemo(() => {
    if (sort !== "release") return [[null, rows]] as [string | null, Row[]][];
    const out: [string | null, Row[]][] = [];
    for (const r of rows) {
      const year = r.entry.releasedAt.slice(0, 4);
      if (out.at(-1)?.[0] !== year) out.push([year, []]);
      out.at(-1)![1].push(r);
    }
    return out;
  }, [rows, sort]);

  const th = (k: SortKey, label: string, cls = "", title?: string) => (
    <th scope="col" className={cn("py-2 font-semibold", cls)} aria-sort={sort === k ? (k === "name" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        // Set flips between A to Z and newest first: on a phone the Released column is hidden.
        onClick={() => setSort(k === "name" && sort === "name" ? "release" : k)}
        title={title}
        className={cn("hover:text-ink", sort === k && "text-ink underline underline-offset-4")}
      >
        {label}
      </button>
    </th>
  );

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left md:min-w-[820px]">
        <caption className="sr-only">Every tracked set: box price, expected value, and the return on the box price</caption>
        <thead>
          <tr className="border-b border-ink text-[12px] text-body">
            {th("name", "Set", "pr-4", "Sort by set name, A to Z; again for newest first")}
            {th("release", "Released", "hidden pr-4 lg:table-cell", "Sort newest first")}
            {th("price", "Box", "hidden pr-4 text-right md:table-cell", "Sort by box price, highest first")}
            {th("ev", "Expected value", "hidden pr-6 text-right whitespace-nowrap md:table-cell", "Sort by expected value, highest first")}
            {th("return", "Return", "w-[36%] pr-4 md:w-[22%] md:pr-6", "Sort by return, best first")}
            <th scope="col" className="hidden py-2 pr-4 font-semibold sm:table-cell">
              Verdict
            </th>
            <th scope="col" className="hidden py-2 font-semibold lg:table-cell">
              Top card
            </th>
          </tr>
        </thead>
        {groups.map(([year, group]) => (
          <tbody key={year ?? "all"}>
            {year && (
              <tr>
                <th scope="colgroup" colSpan={7} className="pt-7 pb-2 text-left">
                  <span className="kicker text-ink">{year}</span>
                  <span className="kicker ml-2 text-muted">{group.length}</span>
                </th>
              </tr>
            )}
            {group.map(({ entry, s, b, at, href }) => {
              const v = verdictFor(at?.ret ?? null, s?.releasedAt);
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
                        {b.packsPerBox} × {shortBoosterName(b.name)}
                      </span>
                    )}
                  </td>
                  <td className="num hidden py-3.5 pr-6 text-right text-[15px] font-semibold whitespace-nowrap md:table-cell">
                    {at ? money(at.evBox) : "—"}
                  </td>
                  <td className="py-3.5 pr-4 md:pr-6">
                    <div className="flex items-center gap-3">
                      <span className="num w-14 shrink-0 text-right text-[15px] font-semibold">{signedPercent(at?.ret)}</span>
                      <ReturnMeter value={at?.ret ?? null} />
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
        ))}
      </table>
    </div>
  );
}

function HowToRead({ settings }: { settings: Settings }) {
  return (
    <div className="grid gap-8 border-t border-hairline pt-8 md:grid-cols-3">
      {[
        [
          "Expected value",
          `Add up every card you could open, each weighted by how often it turns up, at today’s TCGplayer market price, ${settingsPhrase(toParams(settings))}. It’s what an average box is worth — not what yours will be.`,
        ],
        [
          "Return",
          "What the cards are worth compared with what the box costs. +35% means $135 of cards for every $100 spent; −12% means $88. Blue to the right of the line is a gain, red to the left a loss.",
        ],
        [
          "Crack or keep",
          "Within 5% either way we call it a toss-up. Otherwise, crack a box whose cards are worth more than it costs, and leave the rest sealed — or don’t buy them at all.",
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
  const [settings] = useSettings();
  const [, navigate] = useLocation();
  const query = new URLSearchParams(useSearch());
  const requested = query.get("booster");
  const view: BoardView = isView(requested) ? requested : "main";
  const era = ERAS.find((e) => e.value === query.get("years")) ?? null;
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  // Board settings live in the address, so a filtered board can be shared.
  const setBoard = (patch: { booster?: BoardView; years?: string }) => {
    const next = new URLSearchParams(window.location.search);
    const booster = patch.booster ?? view;
    const years = patch.years ?? era?.value ?? "all";
    if (booster === "main") next.delete("booster");
    else next.set("booster", booster);
    if (years === "all") next.delete("years");
    else next.set("years", years);
    const qs = next.toString();
    navigate(qs ? `/?${qs}` : "/", { replace: true });
  };
  useEffect(() => {
    document.title = "Crack or Keep — What a Magic booster box is worth once you open it";
  }, []);

  const sets = useMemo(() => index?.sets ?? [], [index]);
  const lead = sets.find((s) => (s.boosters[0]?.evBox ?? 0) > 0) ?? null;
  const rows = useMemo(() => boardRows(sets, view, era, deferredSearch, settings), [sets, view, era, deferredSearch, settings]);
  // Preorder prices would win this every time; only count sets that are out.
  const best = rows
    .filter((r): r is Row & { s: SetSummary; at: At & { ret: number } } => r.at?.ret != null && isReleased(r.s!.releasedAt))
    .sort((a, b) => b.at.ret - a.at.ret)[0];

  return (
    <>
      <Masthead />
      <main className="mx-auto max-w-page px-4 sm:px-6">
        {lead ? (
          <LeadStory s={lead} b={lead.boosters[0]} at={boosterAt(lead.boosters[0], lead, settings)} settings={settings} />
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
            <div className="flex w-full min-w-0 flex-col gap-2.5 sm:w-auto sm:items-end">
              <div className="flex items-center gap-3">
                <span className="kicker w-16 text-body sm:w-auto">Booster</span>
                <Segmented
                  label="Which booster box to compare"
                  value={view}
                  onChange={(v) => setBoard({ booster: v })}
                  options={VIEWS.map(({ value, label }) => ({ value, label }))}
                />
              </div>
              <div className="flex max-w-full items-center gap-3">
                <span className="kicker w-16 shrink-0 text-body sm:w-auto">Years</span>
                <div className="min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <Segmented
                    label="Which years to show"
                    value={era?.value ?? "all"}
                    onChange={(v) => setBoard({ years: v })}
                    options={[{ value: "all", label: "All" }, ...ERAS.map(({ value, label }) => ({ value, label }))]}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-x-10 gap-y-3 pt-4 pb-1 text-[14px] text-body md:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,320px)] md:items-start">
            <label className="flex h-10 items-center gap-2 border border-ink bg-canvas px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-link">
              <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-body" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5 15 15" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Find a set by name or code"
                aria-label="Find a set by name or code"
                className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
              />
            </label>
            <p>{VIEWS.find((v) => v.value === view)!.note}</p>
            {best && (
              <p>
                Best return right now: <strong className="text-ink">{best.s.name}</strong>, {signedPercent(best.at.ret)}:{" "}
                {money(best.at.evBox)} of cards for a {money(best.b?.boxPrice.usd)} box.
              </p>
            )}
          </div>
          <Board rows={rows} view={view} />
          {rows.length === 0 && (
            <p className="py-10 text-[15px] text-body">{search ? `No set matches “${search}”.` : "No sets sold that booster in those years."}</p>
          )}
          <p className="mt-3 text-[12px] text-body">
            Values use your settings: {settingsPhrase(toParams(settings))}. Change them under Settings at the top of any page. Click
            a column heading to sort. * Estimated street price: TCGplayer had no market price for the box.
          </p>
        </section>

        <section className="mt-16" aria-label="How to read the board">
          <HowToRead settings={settings} />
        </section>
      </main>
    </>
  );
}
