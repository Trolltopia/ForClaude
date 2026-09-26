import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { CardImage } from "@/components/CardImage";
import { ReturnMeter, ShareBar } from "@/components/charts/Bars";
import { RarityPip } from "@/components/RarityPip";
import { Section } from "@/components/Section";
import { Tile } from "@/components/set/KpiRow";
import { Masthead } from "@/components/site/Masthead";
import { HoverCard } from "@/components/ui/hover-card";
import { InfoTip } from "@/components/ui/tooltip";
import { useFixedProduct } from "@/hooks/useFixed";
import { cardValue, FIXED_NAME, FIXED_PATH, fixedVerdict } from "@/lib/fixed";
import { count, date, isReleased, money, percent, signedPercent } from "@/lib/format";
import { toParams, useSettings } from "@/lib/settings";
import type { CardFinish, FixedCard, FixedKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fixedVerdictLine, returnOf, settingsPhrase, VERDICT_TITLE } from "@/lib/verdict";

const FINISH_LABEL: Record<CardFinish, string | null> = { nonfoil: null, foil: "Foil", etched: "Etched foil" };

function versionLabel(c: FixedCard): string {
  return [c.treatmentLabel !== "Regular" ? c.treatmentLabel : null, FINISH_LABEL[c.finish]].filter(Boolean).join(" · ") || "Regular";
}

interface Row {
  c: FixedCard;
  /** What one copy is worth at the reader's settings. */
  each: number;
  total: number;
}

const PAGE = 40;

function CardList({ rows, value }: { rows: Row[]; value: number }) {
  const [limit, setLimit] = useState(PAGE);
  const shown = rows.slice(0, limit);
  const max = rows[0]?.total ?? 0;
  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-left text-[14px] md:min-w-[780px]">
          <caption className="sr-only">Every card inside, with its price, what you keep after your settings, and its share of the total</caption>
          <thead>
            <tr className="border-b border-ink text-[12px] text-body">
              <th scope="col" className="py-2 pr-4 font-semibold">
                Card
              </th>
              <th scope="col" className="hidden py-2 pr-4 font-semibold md:table-cell">
                Version
              </th>
              <th scope="col" className="py-2 pl-4 text-right font-semibold">
                Price
              </th>
              <th scope="col" className="hidden py-2 pl-4 text-right font-semibold sm:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  You keep
                  <InfoTip>The price of one copy after your selling fees. Cards under your minimum price show as bulk and count as nothing.</InfoTip>
                </span>
              </th>
              <th scope="col" className="py-2 pl-4 text-right font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  Total
                  <InfoTip>What you keep from every copy inside.</InfoTip>
                </span>
              </th>
              <th scope="col" className="hidden w-[18%] py-2 pl-6 font-semibold lg:table-cell">
                Share of the value
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map(({ c, each, total }) => (
              <tr key={`${c.id}-${c.finish}`} className="border-b border-hairline hover:bg-canvas-soft">
                <td className="py-2 pr-4">
                  <HoverCard
                    trigger={
                      <a
                        href={c.scryfallUri ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2.5 font-semibold hover:underline hover:underline-offset-2"
                      >
                        <RarityPip rarity={c.rarity} />
                        {c.count > 1 && <span className="num font-normal text-body">{c.count}×</span>}
                        {c.name}
                      </a>
                    }
                  >
                    <div className="w-60">
                      <CardImage card={c} foil={c.finish !== "nonfoil"} eager />
                    </div>
                  </HoverCard>
                  {c.commander && <span className="kicker ml-2 bg-ink px-1.5 py-0.5 text-[10px] text-canvas">Commander</span>}
                  <span className="ml-2 hidden font-mono text-[11px] text-muted uppercase sm:inline">
                    {c.set} {c.cn}
                  </span>
                  <span className="block pl-[18px] text-[12.5px] text-body md:hidden">{versionLabel(c)}</span>
                </td>
                <td className="hidden py-2 pr-4 text-body md:table-cell">{versionLabel(c)}</td>
                <td className="num py-2 pl-4 text-right font-semibold">{money(c.price)}</td>
                <td className="num hidden py-2 pl-4 text-right sm:table-cell">
                  {c.price == null ? (
                    <span className="text-muted">—</span>
                  ) : each === 0 ? (
                    <span className="font-sans text-[12.5px] text-muted" title="Under your minimum price, so it counts as nothing">
                      bulk
                    </span>
                  ) : (
                    money(each)
                  )}
                </td>
                <td className="num py-2 pl-4 text-right">{c.price == null ? <span className="text-muted">—</span> : money(total)}</td>
                <td className="hidden py-2 pl-6 lg:table-cell">
                  <div className="flex items-center gap-3">
                    <ShareBar value={total} max={max} className="flex-1" />
                    <span className="num w-10 shrink-0 text-right text-[12.5px] text-body">{value > 0 ? percent(total / value) : "—"}</span>
                  </div>
                </td>
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

export function FixedPage({ kind, id }: { kind: FixedKind; id: string }) {
  const { status, product } = useFixedProduct(kind, id);
  const [settings] = useSettings();
  const name = FIXED_NAME[kind];
  const noun = kind === "commander" ? "deck" : "drop";

  useEffect(() => {
    if (product) document.title = `${product.name} — ${name.one} — Crack or Keep`;
  }, [product, name.one]);

  const rows: Row[] = useMemo(
    () =>
      (product?.cards ?? [])
        .map((c) => {
          const each = cardValue(c.price, settings);
          return { c, each, total: each * c.count };
        })
        .sort((a, b) => b.total - a.total || (b.c.price ?? -1) - (a.c.price ?? -1) || a.c.name.localeCompare(b.c.name)),
    [product, settings],
  );

  const back = (
    <Link href={`/${FIXED_PATH[kind]}`} className="hover-rule kicker text-body">
      ← Every {name.one}
    </Link>
  );

  if (!product) {
    return (
      <>
        <Masthead variant="compact" />
        <main className="mx-auto max-w-page px-4 py-16 sm:px-6">
          {back}
          {status === "loading" ? (
            <p className="mt-8 text-[15px] text-body">Loading…</p>
          ) : (
            <>
              <h1 className="display mt-6 text-[48px] leading-none sm:text-[64px]">Not on our list</h1>
              <p className="mt-5 max-w-2xl font-serif text-[19px] text-ink-soft">
                We don&rsquo;t have a {name.one} at this address. It may have been renamed; the list has every one we price.
              </p>
            </>
          )}
        </main>
      </>
    );
  }

  const value = rows.reduce((s, r) => s + r.total, 0);
  const price = product.price.usd;
  const ret = returnOf(price, value);
  const released = isReleased(product.releasedAt);
  const copies = rows.reduce((s, r) => s + r.c.count, 0);
  // Cards without a market price count as nothing, which makes the value a floor.
  const unpriced = rows.filter((r) => r.c.price == null).reduce((s, r) => s + r.c.count, 0);
  const verdict = fixedVerdict(ret, copies ? 1 - unpriced / copies : 0, product.releasedAt);
  const commanders = product.cards.filter((c) => c.commander).map((c) => c.name);
  const topFive = rows.slice(0, 5).reduce((s, r) => s + r.total, 0);
  const cheap = rows.filter((r) => r.c.price == null || r.c.price < 1).reduce((s, r) => s + r.c.count, 0);
  const best = rows.filter((r) => r.c.price != null).slice(0, kind === "commander" ? 6 : 8);
  const diff = price != null ? value - price : null;
  const phrase = settingsPhrase(toParams(settings));

  return (
    <>
      <Masthead variant="compact" />
      <main className="mx-auto max-w-page px-4 sm:px-6">
        <header className="grid gap-8 pt-8 pb-8 sm:pt-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
          <div>
            {back}
            <p className="kicker mt-8 text-body">
              {[name.one, product.setName.toLowerCase() === name.one.toLowerCase() ? null : product.setName, `${released ? "Released" : "Releases"} ${date(product.releasedAt)}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="display mt-3 text-[clamp(44px,7.4vw,100px)] leading-[0.92]">{product.name}</h1>
            <p className="mt-6 max-w-2xl font-serif text-[19px] leading-[1.5] text-ink-soft sm:text-[21px]">
              {price != null ? (
                <>
                  The sealed {noun} sells for about <strong className="font-semibold">{money(price)}</strong> on TCGplayer. Its{" "}
                  {count(copies)} cards are worth <strong className="font-semibold">{money(value)}</strong> on today&rsquo;s prices, {phrase}.
                </>
              ) : (
                <>
                  TCGplayer has no market price for the sealed {noun} yet. Its {count(copies)} cards are worth{" "}
                  <strong className="font-semibold">{money(value)}</strong> on today&rsquo;s prices, {phrase}.
                </>
              )}
              {unpriced > 0 && (
                <>
                  {" "}
                  {count(unpriced)} of them {unpriced === 1 ? "has" : "have"} no market price yet and count as nothing, so that&rsquo;s a floor.
                </>
              )}
              {commanders.length > 0 && <> Led by {commanders.join(" and ")}.</>}
            </p>
          </div>
          {price != null && (verdict || unpriced > 0) && (
            <aside
              className={cn(
                "flex flex-col justify-between self-start p-6 lg:mt-16",
                verdict && verdict !== "early" ? "bg-ink text-canvas" : "border-2 border-ink",
              )}
              aria-label="Verdict"
            >
              <p className="kicker opacity-70">The verdict</p>
              <p className="display mt-2 text-[44px] leading-none">{verdict ? VERDICT_TITLE[verdict] : "Not enough prices"}</p>
              <p className="mt-4 font-serif text-[16px] leading-snug opacity-90">
                {verdict
                  ? fixedVerdictLine(price, value, noun, product.releasedAt, unpriced)
                  : `${count(unpriced)} of the ${count(copies)} cards have no market price yet. Without them the cards come to ${money(value)}, so we can’t yet say whether opening beats the sealed price.`}
              </p>
            </aside>
          )}
        </header>

        <div className="grid grid-cols-1 divide-hairline border-y border-hairline sm:grid-cols-2 sm:divide-x lg:grid-cols-4">
          <Tile
            hero
            label="Cards are worth"
            info={`Every card at its TCGplayer market price in the finish the ${noun} holds it, times the copies, ${phrase}.`}
            value={money(value)}
            foot={
              diff != null ? (
                <span className={released ? (diff >= 0 ? "text-good" : "text-bad") : ""}>
                  {diff >= 0 ? "▲" : "▼"} {money(Math.abs(diff))} {diff >= 0 ? "more" : "less"} than sealed
                </span>
              ) : (
                "No sealed price to compare"
              )
            }
          />
          <Tile
            label="Sealed price"
            info={`TCGplayer’s market price for the sealed ${noun}: what copies have recently sold for.`}
            value={money(price)}
            foot={
              product.price.productUrl ? (
                <a className="prose-link" href={product.price.productUrl} target="_blank" rel="noreferrer">
                  The TCGplayer listing
                </a>
              ) : (
                "Not listed on TCGplayer"
              )
            }
          />
          <Tile
            label="Return"
            info="What the cards are worth compared with the sealed price. +35% means $135 of cards for every $100 spent; −12% means $88. Zero is break-even."
            value={<span className={!released || ret == null ? "" : ret >= 0 ? "text-good" : "text-bad"}>{signedPercent(ret)}</span>}
            foot={ret != null ? <ReturnMeter value={ret} /> : "Needs a sealed price"}
          />
          {copies > 10 ? (
            <Tile
              label="In the top five cards"
              info="How much of the value sits in the five most valuable cards. The rest is mostly cards that are slow to sell one at a time."
              value={value > 0 ? percent(topFive / value) : "—"}
              foot={`${count(cheap)} of the ${count(copies)} cards are under $1 each`}
            />
          ) : (
            <Tile
              label="The best card"
              info="How much of the value sits in the single most valuable card."
              value={value > 0 && rows[0] ? percent(rows[0].total / value) : "—"}
              foot={rows[0] ? `${rows[0].c.name}: ${money(rows[0].total)} of ${money(value)}` : undefined}
            />
          )}
        </div>

        {best.length > 0 && (
          <Section id="best" number="01" rail="The best cards" title="Where the money is" dek={`The most valuable cards inside, in the finish the ${noun} holds them.`}>
            <ol className={cn("grid grid-cols-2 gap-x-5 gap-y-9 sm:grid-cols-3", kind === "commander" ? "lg:grid-cols-6" : "lg:grid-cols-4")}>
              {best.map(({ c, total }, i) => (
                <li key={`${c.id}-${c.finish}`} className="group min-w-0">
                  <a href={c.scryfallUri ?? undefined} target="_blank" rel="noreferrer" className="block outline-none" aria-label={`${c.name}, ${versionLabel(c)}, ${money(c.price)}`}>
                    <CardImage card={c} foil={c.finish !== "nonfoil"} eager={i < 4} className="transition-transform duration-300 group-hover:-translate-y-1" />
                  </a>
                  <div className="mt-3 border-t border-ink pt-2">
                    <span className="block truncate font-sans text-[15px] font-bold">{c.name}</span>
                    <span className="block text-[13px] text-body">{versionLabel(c)}</span>
                    <span className="num mt-1 block text-[15px] font-semibold">
                      {money(c.price)}
                      {c.count > 1 && <span className="font-normal text-body"> × {c.count} = {money(total)}</span>}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        <Section
          id="cards"
          number={best.length > 0 ? "02" : "01"}
          rail="Every card"
          title="What’s inside"
          dek={`All ${count(copies)} cards, most valuable first, ${phrase}. Hover a name to see the card.`}
        >
          <CardList rows={rows} value={value} />
          {product.notes.length > 0 && (
            <ul className="mt-6 space-y-1 text-[13px] text-body">
              {product.notes.map((n) => (
                <li key={n}>Note: {n}</li>
              ))}
            </ul>
          )}
          <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-body">
            Card list from MTGJSON, card prices from TCGplayer by way of Scryfall, sealed price from TCGplayer by way of TCGCSV.{" "}
            <Link href="/method#fixed" className="prose-link">
              How we price decks and drops
            </Link>
            .
          </p>
        </Section>
      </main>
    </>
  );
}
