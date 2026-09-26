import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ReturnMeter } from "@/components/charts/Bars";
import { Masthead } from "@/components/site/Masthead";
import { useFixedIndex } from "@/hooks/useFixed";
import { FIXED_NAME, FIXED_PATH, fixedReturn, fixedValue, fixedVerdict, isComplete } from "@/lib/fixed";
import { count, isReleased, money, monthYear, signedPercent } from "@/lib/format";
import { toParams, useSettings, type Settings } from "@/lib/settings";
import type { FixedKind, FixedSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { settingsPhrase, VERDICT_TITLE, verdictFor, type Verdict } from "@/lib/verdict";

/** Newest first by default; Commander decks sit under a heading for their set. */
type SortKey = "release" | "set" | "name" | "price" | "value" | "return";

interface Row {
  p: FixedSummary;
  value: number;
  ret: number | null;
  href: string;
}

const COPY: Record<FixedKind, { title: string; intro: (phrase: string) => string; search: string; noun: string }> = {
  commander: {
    title: "Every Commander deck, priced card by card",
    intro: (phrase) =>
      `A preconstructed Commander deck holds the same hundred cards every time, so there’s no luck in opening one: it’s worth what its cards are worth. Here is every deck with its cards at this morning’s TCGplayer market prices, ${phrase}, against what the sealed deck sells for.`,
    search: "Find a deck, commander or set",
    noun: "deck",
  },
  "secret-lair": {
    title: "Every Secret Lair drop, priced card by card",
    intro: (phrase) =>
      `A Secret Lair drop is a fixed handful of cards, mostly reprints in new art, sold sealed. Here is every drop with its cards at this morning’s TCGplayer market prices, ${phrase}, against what the sealed drop sells for.`,
    search: "Find a drop or its best card",
    noun: "drop",
  },
};

// A long list renders in pages; searching shows every match.
const PAGE = 150;

function rowsFor(products: FixedSummary[], kind: FixedKind, settings: Settings, needle: string): Row[] {
  const q = needle.trim().toLowerCase();
  return products
    .filter(
      (p) =>
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.setName.toLowerCase().includes(q) ||
        p.setCode.toLowerCase() === q ||
        p.commanders.some((c) => c.toLowerCase().includes(q)) ||
        !!p.topCard?.name.toLowerCase().includes(q),
    )
    .map((p) => {
      const value = fixedValue(p.values, settings);
      return { p, value, ret: fixedReturn(p.price.usd, value, p.pricedShare), href: `/${FIXED_PATH[kind]}/${p.id}` };
    });
}

function sortRows(rows: Row[], sort: SortKey): Row[] {
  const byRelease = (a: Row, b: Row) =>
    b.p.releasedAt.localeCompare(a.p.releasedAt) || a.p.setName.localeCompare(b.p.setName) || a.p.name.localeCompare(b.p.name);
  if (sort === "release") return [...rows].sort(byRelease);
  if (sort === "set") return [...rows].sort((a, b) => a.p.setName.localeCompare(b.p.setName) || byRelease(a, b));
  if (sort === "name") return [...rows].sort((a, b) => a.p.name.localeCompare(b.p.name));
  const key = (r: Row) => (sort === "price" ? (r.p.price.usd ?? -Infinity) : sort === "value" ? r.value : (r.ret ?? -Infinity));
  return [...rows].sort((a, b) => key(b) - key(a) || byRelease(a, b));
}

/** How the priced, released products split between the three verdicts. */
function Tally({ rows, noun }: { rows: Row[]; noun: string }) {
  const counts: Record<Exclude<Verdict, "early">, number> = { crack: 0, "toss-up": 0, keep: 0 };
  for (const r of rows) {
    if (!isComplete(r.p.pricedShare)) continue;
    const v = verdictFor(r.ret, r.p.releasedAt);
    if (v && v !== "early") counts[v]++;
  }
  const total = counts.crack + counts["toss-up"] + counts.keep;
  if (!total) return null;
  const parts: { key: keyof typeof counts; label: string; cls: string }[] = [
    { key: "crack", label: `Worth more opened`, cls: "bg-accent" },
    { key: "toss-up", label: "Within 5%", cls: "bg-hairline" },
    { key: "keep", label: `Worth more sealed`, cls: "bg-keep" },
  ];
  return (
    <figure className="mt-8">
      <figcaption className="text-[13px] text-body">
        Of the {count(total)} released {noun}s with a sealed price and every card priced, at your settings:
      </figcaption>
      <div className="mt-3 flex h-3 w-full overflow-hidden" aria-hidden="true">
        {parts.map(({ key, cls }) => (
          <div key={key} className={cls} style={{ width: `${(counts[key] / total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-4">
        {parts.map(({ key, label, cls }) => (
          <div key={key}>
            <dt className="flex items-center gap-2 text-[12.5px] font-bold">
              <span aria-hidden="true" className={cn("inline-block size-2.5", cls)} />
              {label}
            </dt>
            <dd className="num mt-1 font-sans text-[26px] font-semibold tracking-[-0.02em] sm:text-[32px]">
              {count(counts[key])}
              <span className="ml-2 text-[14px] font-normal text-body">{Math.round((counts[key] / total) * 100)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}

function Board({ rows: all, kind, grouped }: { rows: Row[]; kind: FixedKind; grouped: boolean }) {
  const [sort, setSort] = useState<SortKey>("release");
  const [limit, setLimit] = useState(PAGE);
  const [, navigate] = useLocation();
  // A new search starts from the first page again; the sort stays.
  useEffect(() => setLimit(PAGE), [all.length]);
  const sorted = useMemo(() => sortRows(all, sort), [all, sort]);
  const shown = sorted.slice(0, limit);
  // Commander decks sit under their set; Secret Lair drops are one long list.
  const groups = useMemo(() => {
    if (!grouped || (sort !== "release" && sort !== "set")) return [[null, shown]] as [string | null, Row[]][];
    const out: [string | null, Row[]][] = [];
    for (const r of shown) {
      if (out.at(-1)?.[1][0]?.p.setCode !== r.p.setCode) out.push([r.p.setCode, []]);
      out.at(-1)![1].push(r);
    }
    return out;
  }, [shown, sort, grouped]);
  const noun = FIXED_NAME[kind].one.split(" ").at(-1)!;

  const th = (k: SortKey, label: string, cls = "", title?: string) => (
    <th scope="col" className={cn("py-2 font-semibold", cls)} aria-sort={sort === k ? (k === "name" || k === "set" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => setSort(sort === k && k !== "release" ? "release" : k)}
        title={title}
        className={cn("hover:text-ink", sort === k && "text-ink underline underline-offset-4")}
      >
        {label}
      </button>
    </th>
  );

  return (
    <>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-left md:min-w-[820px]">
          <caption className="sr-only">
            Every {FIXED_NAME[kind].one}: sealed price, what its cards are worth, and the return on the sealed price
          </caption>
          <thead>
            <tr className="border-b border-ink text-[12px] text-body">
              {th("name", noun === "deck" ? "Deck" : "Drop", "pr-4", "Sort by name, A to Z; again for newest first")}
              {grouped
                ? th("set", "Set", "hidden pr-4 lg:table-cell", "Sort by set, A to Z; again for newest first")
                : th("release", "Released", "hidden pr-4 lg:table-cell", "Sort newest first")}
              {th("price", "Sealed", "hidden pr-4 text-right md:table-cell", "Sort by sealed price, highest first")}
              {th("value", "Cards are worth", "hidden pr-6 text-right whitespace-nowrap md:table-cell", "Sort by what the cards are worth, highest first")}
              {th("return", "Return", "w-[36%] pr-4 md:w-[22%] md:pr-6", "Sort by return, best first")}
              <th scope="col" className="hidden py-2 pr-4 font-semibold sm:table-cell">
                Verdict
              </th>
              <th scope="col" className="hidden py-2 font-semibold xl:table-cell">
                Top card
              </th>
            </tr>
          </thead>
          {groups.map(([code, group], gi) => (
            <tbody key={`${code ?? "all"}-${gi}`}>
              {code && (
                <tr>
                  <th scope="colgroup" colSpan={7} className="pt-7 pb-2 text-left">
                    <span className="kicker text-ink">{group[0].p.setName}</span>
                    <span className="kicker ml-2 text-muted">
                      {monthYear(group[0].p.releasedAt)} · {group.length}
                    </span>
                  </th>
                </tr>
              )}
              {group.map(({ p, value, ret, href }) => {
                const v = fixedVerdict(ret, p.pricedShare, p.releasedAt);
                const partial = !isComplete(p.pricedShare);
                return (
                  <tr key={p.id} className="group cursor-pointer border-b border-hairline hover:bg-canvas-soft" onClick={() => navigate(href)}>
                    <th scope="row" className="py-3.5 pr-4 font-normal">
                      <Link href={href} className="block" onClick={(e) => e.stopPropagation()}>
                        <span className="font-sans text-[16px] font-bold group-hover:underline group-hover:underline-offset-4">{p.name}</span>
                        <span className="mt-0.5 block text-[12.5px] text-body">
                          {p.commanders.length ? `Led by ${p.commanders.join(" and ")}` : `${count(p.cardCount)} cards`}
                          {grouped && sort !== "release" && sort !== "set" && <span className="text-muted"> · {p.setName}</span>}
                        </span>
                      </Link>
                    </th>
                    <td className="num hidden py-3.5 pr-4 text-[14px] whitespace-nowrap text-body lg:table-cell">
                      {grouped ? <span className="font-sans">{p.setCode}</span> : monthYear(p.releasedAt)}
                    </td>
                    <td className="num hidden py-3.5 pr-4 text-right text-[15px] whitespace-nowrap md:table-cell">{money(p.price.usd)}</td>
                    <td className="num hidden py-3.5 pr-6 text-right text-[15px] font-semibold whitespace-nowrap md:table-cell">
                      {money(value)}
                      {partial && (
                        <span className="ml-0.5 font-normal text-muted" title={`Only ${Math.round(p.pricedShare * 100)}% of the cards have a price yet`}>
                          *
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 md:pr-6">
                      <div className="flex items-center gap-3">
                        <span className="num w-14 shrink-0 text-right text-[15px] font-semibold">{signedPercent(ret)}</span>
                        <ReturnMeter value={ret} />
                      </div>
                    </td>
                    <td className="hidden py-3.5 pr-4 text-[14px] font-semibold whitespace-nowrap sm:table-cell">
                      {v ? (
                        VERDICT_TITLE[v]
                      ) : (
                        <span className="font-normal text-muted">{p.price.usd == null ? "No sealed price" : "Prices missing"}</span>
                      )}
                    </td>
                    <td className="hidden max-w-56 py-3.5 text-[14px] xl:table-cell">
                      {p.topCard ? (
                        <span className="block truncate">
                          {p.topCard.name} <span className="num text-body">{money(p.topCard.price)}</span>
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
      {sorted.length > shown.length && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setLimit(sorted.length)}
            className="h-10 border border-ink px-5 text-[14px] font-bold hover:bg-ink hover:text-canvas"
          >
            Show all {count(sorted.length)} {FIXED_NAME[kind].many.split(" ").at(-1)}
          </button>
        </div>
      )}
    </>
  );
}

function HowToRead({ kind, settings }: { kind: FixedKind; settings: Settings }) {
  const noun = COPY[kind].noun;
  return (
    <div className="grid gap-8 border-t border-hairline pt-8 md:grid-cols-3">
      {[
        [
          "Cards are worth",
          `Every card at its TCGplayer market price in the finish the ${noun} holds it — foil, etched or regular — times the copies, ${settingsPhrase(toParams(settings))}.`,
        ],
        ["Sealed", `TCGplayer’s market price for the sealed ${noun}: what copies have recently sold for.`],
        [
          "No luck involved",
          `Unlike a booster box, you know exactly what’s inside, so the return is the whole story on today’s prices. The risk is in selling: a hundred singles take time, and cheap ones rarely sell at market price.`,
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

export function FixedBoardPage({ kind }: { kind: FixedKind }) {
  const { status, index } = useFixedIndex(kind);
  const [settings] = useSettings();
  const [search, setSearch] = useState("");
  const needle = useDeferredValue(search);
  const copy = COPY[kind];
  const name = FIXED_NAME[kind];

  useEffect(() => {
    document.title = `${name.many} — Crack or Keep`;
  }, [name.many]);

  const everything = useMemo(() => rowsFor(index?.products ?? [], kind, settings, ""), [index, kind, settings]);
  const rows = useMemo(() => (needle.trim() ? rowsFor(index?.products ?? [], kind, settings, needle) : everything), [everything, index, kind, settings, needle]);
  const priced = everything.filter((r) => r.p.price.usd != null).length;
  const best = everything
    .filter((r): r is Row & { ret: number } => r.ret != null && isReleased(r.p.releasedAt) && isComplete(r.p.pricedShare))
    .sort((a, b) => b.ret - a.ret)[0];

  return (
    <>
      <Masthead variant="compact" />
      <main className="mx-auto max-w-page px-4 sm:px-6">
        <header className="grid gap-8 border-b-2 border-rule pt-10 pb-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16">
          <div>
            <p className="kicker text-body">{name.many}</p>
            <h1 className="display mt-3 text-[clamp(44px,7vw,92px)] leading-[0.92]">{copy.title}</h1>
            <p className="mt-6 max-w-2xl font-serif text-[19px] leading-[1.55] text-ink-soft sm:text-[21px]">
              {copy.intro(settingsPhrase(toParams(settings)))}
            </p>
          </div>
          <div className="self-end">
            {index && (
              <dl className="grid grid-cols-2 border-t border-ink">
                <div className="border-r border-hairline pt-3 pr-3">
                  <dt className="text-[12px] font-bold sm:text-[13px]">{name.many}</dt>
                  <dd className="num mt-1 font-sans text-[34px] font-semibold tracking-[-0.02em] sm:text-[40px]">{count(everything.length)}</dd>
                </div>
                <div className="pt-3 pl-4">
                  <dt className="text-[12px] font-bold sm:text-[13px]">With a sealed price</dt>
                  <dd className="num mt-1 font-sans text-[34px] font-semibold tracking-[-0.02em] sm:text-[40px]">{count(priced)}</dd>
                </div>
              </dl>
            )}
            <Tally rows={everything} noun={copy.noun} />
          </div>
        </header>

        {status === "ready" && !index && (
          <div className="py-12">
            <p className="kicker text-body">No snapshot yet</p>
            <p className="mt-4 max-w-2xl font-serif text-[19px] leading-relaxed text-ink-soft">
              {name.many} haven&rsquo;t been priced on this copy of the site. The daily job does it; locally, run{" "}
              <code className="bg-canvas-soft px-1.5 font-mono text-[16px]">npm run data -- {kind === "commander" ? "--decks" : "--secret-lair"}</code>.
            </p>
          </div>
        )}

        {index && (
          <section className="mt-10" aria-label={`Every ${name.one}`}>
            <div className="grid gap-x-10 gap-y-3 pb-1 text-[14px] text-body md:grid-cols-[minmax(0,300px)_minmax(0,1fr)] md:items-center">
              <label className="flex h-10 items-center gap-2 border border-ink bg-canvas px-3 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-link">
                <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-body" aria-hidden="true">
                  <circle cx="6.5" cy="6.5" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10.5 10.5 15 15" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={copy.search}
                  aria-label={copy.search}
                  className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
                />
              </label>
              {best && (
                <p className="md:text-right">
                  Best return right now: <Link href={best.href} className="font-bold text-ink hover:underline">{best.p.name}</Link>,{" "}
                  {signedPercent(best.ret)}: {money(best.value)} of cards for a {money(best.p.price.usd)} {copy.noun}.
                </p>
              )}
            </div>
            <Board rows={rows} kind={kind} grouped={kind === "commander"} />
            {rows.length === 0 && <p className="py-10 text-[15px] text-body">Nothing matches &ldquo;{search}&rdquo;.</p>}
            <p className="mt-3 text-[12px] text-body">
              Values use your settings: {settingsPhrase(toParams(settings))}. Change them under Settings at the top of any page. Click a
              column heading to sort. A dash means TCGplayer has no market price for the sealed {copy.noun}. * Some cards have no market
              price yet and count as nothing, so the value is a floor.
            </p>
          </section>
        )}

        <section className="mt-16" aria-label="How to read this list">
          <HowToRead kind={kind} settings={settings} />
        </section>
      </main>
    </>
  );
}
