import { useEffect, useMemo } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { Section } from "@/components/Section";
import { BoosterTabs } from "@/components/set/BoosterTabs";
import { BulkSection } from "@/components/set/BulkSection";
import { CardTable } from "@/components/set/CardTable";
import { ChaseGrid } from "@/components/set/ChaseGrid";
import { Controls } from "@/components/set/Controls";
import { KpiRow } from "@/components/set/KpiRow";
import { SealedSection, SealedUnavailable } from "@/components/set/SealedSection";
import { ModelDetails } from "@/components/set/ModelDetails";
import { SetHeader } from "@/components/set/SetHeader";
import { SimulationSection } from "@/components/set/SimulationSection";
import { ValueBySlot } from "@/components/set/ValueBySlot";
import { Masthead } from "@/components/site/Masthead";
import { useSnapshot } from "@/hooks/useSnapshot";
import { useQueryNumbers } from "@/hooks/useQueryState";
import { SIM_BOXES, useSimulation } from "@/hooks/useSimulation";
import { boosterName, boosterView, byBoosterOrder } from "@/lib/boosters";
import { computeEv, DEFAULT_FEES, type EvParams } from "@/lib/engine/ev";
import { count, isReleased, money, percent } from "@/lib/format";
import type { BoosterType } from "@/lib/types";
import { catalogEntry } from "@/sets/catalog";

const QUERY_KEYS = ["box", "floor", "fees"] as const;
/** Up to half: enough for a store that sells in bulk to other stores rather than card by card. */
const MAX_FEES = 50;

/** /sets/fdn for the main booster, /sets/fdn/collector for the others; floor and fees carry over, a box price doesn't. */
function boosterHref(code: string, type: BoosterType, main: BoosterType | undefined, search: string, box: number | null = null) {
  const params = new URLSearchParams(search);
  params.delete("box");
  if (box != null) params.set("box", String(box));
  const qs = params.toString();
  return `/sets/${code}${type === main ? "" : `/${type}`}${qs ? `?${qs}` : ""}`;
}

export function SetPage({ code, booster: requested }: { code: string; booster?: string }) {
  const entry = catalogEntry(code);
  const { status, snapshot: set, live, refreshing, error, refresh } = useSnapshot(code);
  const [query, setQuery] = useQueryNumbers(QUERY_KEYS);
  const [, navigate] = useLocation();
  const search = useSearch();

  const defaultFees = Math.round(DEFAULT_FEES * 100);
  const floor = Math.max(0, Math.min(1000, query.floor ?? 0));
  const fees = Math.max(0, Math.min(MAX_FEES, query.fees ?? defaultFees));
  const params = useMemo<EvParams>(() => ({ floor, fees: fees / 100 }), [floor, fees]);

  const main = set?.boosters[0]?.type;
  const current = set?.boosters.find((b) => b.type === requested) ?? set?.boosters[0] ?? null;
  const snapshot = useMemo(() => (set && current ? boosterView(set, current) : null), [set, current]);
  const marketPrice = snapshot?.boxPrice ?? { usd: null, source: "estimate" as const };
  const boxPrice = query.box ?? marketPrice.usd;

  const ev = useMemo(() => (snapshot ? computeEv(snapshot, params) : null), [snapshot, params]);
  const { summary: sim, running } = useSimulation(snapshot, params, boxPrice);

  // Every booster of the set at the same settings, for the tabs and the sealed table.
  const boosters = useMemo(
    () =>
      set?.boosters.map((b) => {
        const e = b === current && ev ? ev : computeEv(boosterView(set, b), params);
        return { booster: b, evBox: e.evBox, evPack: e.evPack };
      }) ?? [],
    [set, current, ev, params],
  );

  // A booster this set doesn't have (an old link, a typo): show the main one at its own address.
  useEffect(() => {
    if (set && requested && current?.type !== requested) navigate(boosterHref(code, current!.type, main, search, query.box), { replace: true });
  }, [set, requested, current, main, code, search, query.box, navigate]);

  useEffect(() => {
    const name = set?.name ?? entry?.name;
    const product = snapshot && set && set.boosters.length > 1 ? ` ${snapshot.product.name}` : " booster";
    document.title = name ? `${name}${product} box value — Crack or Keep` : "Crack or Keep";
  }, [set, snapshot, entry?.name]);

  if (!entry && status === "error") return <Missing code={code} />;

  return (
    <>
      <Masthead variant="compact" />
      <main className="mx-auto max-w-page px-4 sm:px-6">
        {status === "loading" && !snapshot && <Loading name={entry?.name ?? code.toUpperCase()} />}
        {status === "error" && !snapshot && <Unavailable name={entry?.name ?? code.toUpperCase()} message={error} />}

        {snapshot && ev && (
          <>
            {live && (
              <p className="mt-6 border-l-2 border-ink bg-canvas-soft px-4 py-3 text-[14px]">
                Built just now in your browser from Scryfall. The daily snapshot for this set hasn&rsquo;t been published yet, so
                the box price is an estimate until you enter your own.
              </p>
            )}
            <SetHeader snapshot={snapshot} boxPrice={boxPrice} evBox={ev.evBox} params={params} />

            <BoosterTabs
              current={snapshot.booster}
              provisional={!isReleased(snapshot.releasedAt)}
              tabs={[
                ...boosters.map(({ booster: b, evBox }) => ({
                  type: b.type,
                  name: b.name,
                  packsPerBox: b.packsPerBox,
                  boxPrice: b === current ? boxPrice : b.boxPrice.usd,
                  evBox,
                  href: boosterHref(code, b.type, main, search),
                })),
                // Boosters the set was sold in that nobody has published sheets for yet.
                ...(entry?.boosters ?? [])
                  .filter((spec) => !set!.boosters.some((b) => b.type === spec.type))
                  .map((spec) => ({
                    type: spec.type,
                    name: boosterName(spec.type, set!.releasedAt),
                    packsPerBox: spec.packsPerBox,
                    boxPrice: null,
                    evBox: 0,
                    href: null,
                  })),
              ].sort(byBoosterOrder)}
            />
            <Controls
              productName={snapshot.product.name}
              packsPerBox={snapshot.product.packsPerBox}
              boxPrice={boxPrice}
              marketPrice={marketPrice}
              overridden={query.box != null}
              onBoxPrice={(v) => setQuery({ box: v })}
              floor={floor}
              onFloor={(v) => setQuery({ floor: v === 0 ? null : v })}
              fees={fees}
              onFees={(v) => setQuery({ fees: v === defaultFees ? null : v })}
              defaultFees={defaultFees}
              onReset={() => setQuery({ box: null, floor: null, fees: null })}
            />
            <KpiRow
              evBox={ev.evBox}
              evPack={ev.evPack}
              boxPrice={boxPrice}
              sim={sim}
              simRunning={running}
              provisional={!isReleased(snapshot.releasedAt)}
            />
            {ev.pricedShare < 0.95 && (
              <p className="mt-4 text-[13px] text-body">
                {percent(1 - ev.pricedShare)} of the cards you can open have no TCGplayer market price, so they count as zero and
                the real value is higher.
              </p>
            )}

            <Section
              id="value"
              number="01"
              rail="By slot"
              title="Where the money is"
              dek={
                <>
                  Each slot in a pack draws from its own pool of cards. The rare slot usually does the heavy lifting, but foils and
                  Booster Fun treatments add up. The ten most valuable cards account for{" "}
                  <strong className="font-semibold text-ink">{percent(ev.top10Share)}</strong> of a box&rsquo;s expected value.
                </>
              }
            >
              <ValueBySlot ev={ev} />
            </Section>

            <Section
              id="sealed"
              number="02"
              rail="Sealed"
              title="Sealed product"
              dek={
                <>
                  What the set sells for unopened, from single packs to cases. Anything with a set number of boosters inside is priced
                  per booster, against what an average booster of that kind is worth at your settings:{" "}
                  <strong className="font-semibold text-ink">{money(ev.evPack)}</strong> for a {snapshot.product.name}.
                </>
              }
            >
              {snapshot.sealed?.length ? (
                <SealedSection
                  products={snapshot.sealed}
                  boosters={boosters.map(({ booster: b, evPack }) => ({
                    type: b.type,
                    name: b.name,
                    packsPerBox: b.packsPerBox,
                    evPack,
                    boxUrl: b.boxPrice.productUrl ?? null,
                  }))}
                  current={snapshot.booster}
                  boxPrice={boxPrice}
                  onUseAsBox={(type, price) => {
                    if (type === snapshot.booster) setQuery({ box: price });
                    else navigate(boosterHref(code, type, main, search, price));
                  }}
                />
              ) : (
                <SealedUnavailable />
              )}
            </Section>

            <Section
              id="chase"
              number="03"
              rail="Chase cards"
              title="The cards that pay for the box"
              dek="A card worth $80 that shows up once in forty boxes adds two dollars to each one. These are the cards the average box leans on."
            >
              <ChaseGrid cards={ev.cards} packs={snapshot.product.packsPerBox} />
            </Section>

            <Section
              id="simulation"
              number="04"
              rail="Simulation"
              title="Ten thousand boxes"
              dek={
                sim && boxPrice ? (
                  <>
                    The average hides how lopsided a box is. We opened {count(SIM_BOXES)} of them, pack by pack.{" "}
                    <strong className="font-semibold text-ink">{percent(sim.beatPrice)}</strong> were worth the{" "}
                    {money(boxPrice)} they cost; the typical box came to {money(sim.percentiles.p50)}.
                  </>
                ) : (
                  "The average hides how lopsided a box is, so we open ten thousand of them, pack by pack."
                )
              }
            >
              <SimulationSection snapshot={snapshot} params={params} boxPrice={boxPrice} sim={sim} running={running} />
            </Section>

            <Section
              id="bulk"
              number="05"
              rail="Buying in bulk"
              title="One box or a hundred"
              dek="Expected value is what a box is worth averaged over a very large number of boxes. Open one and the result can land far from it; open a hundred and the average box settles close to it. Each row shows runs of that many boxes at your settings."
            >
              {sim?.bulk?.length ? (
                <BulkSection bulk={sim.bulk} boxPrice={boxPrice} evBox={ev.evBox} />
              ) : (
                <p className="text-[14px] text-body">Simulating…</p>
              )}
            </Section>

            <Section id="cards" number="06" rail="Card list" title="Every card you can open" dek="Sorted by what each card adds to an average box. “You keep” is the price after your selling fees; cards under your floor show as bulk. Hover a name to see the card.">
              <CardTable cards={ev.cards} />
            </Section>

            <Section
              id="model"
              number="07"
              rail="Collation"
              title="How the box is modelled"
              dek={
                <>
                  The odds of every slot, where the prices come from, and what we assumed. The long version is on the{" "}
                  <Link href="/method" className="prose-link">
                    method page
                  </Link>
                  .
                </>
              }
            >
              <ModelDetails snapshot={snapshot} live={live} refreshing={refreshing} onRefresh={refresh} error={error} />
            </Section>
          </>
        )}
      </main>
    </>
  );
}

function Loading({ name }: { name: string }) {
  return (
    <div className="py-24">
      <p className="kicker text-body">Loading</p>
      <p className="display mt-3 text-[56px] leading-none">{name}</p>
      <p className="mt-4 font-serif text-[18px] text-body italic">Counting cards…</p>
    </div>
  );
}

function Unavailable({ name, message }: { name: string; message: string | null }) {
  return (
    <div className="max-w-2xl py-24">
      <p className="kicker text-body">No data yet</p>
      <p className="display mt-3 text-[56px] leading-none">{name}</p>
      <p className="mt-5 font-serif text-[18px] leading-relaxed text-ink-soft">
        There&rsquo;s no price snapshot for this set yet. Snapshots are rebuilt every morning; if you&rsquo;re running the site
        locally, <code className="bg-canvas-soft px-1.5 py-0.5 font-mono text-[15px]">npm run data</code> builds them.
      </p>
      {message && <p className="mt-3 text-[14px] text-body">{message}</p>}
      <Link href="/" className="prose-link mt-6 inline-block">
        Back to the board
      </Link>
    </div>
  );
}

function Missing({ code }: { code: string }) {
  return (
    <>
      <Masthead variant="compact" />
      <main className="mx-auto max-w-page px-4 py-24 sm:px-6">
        <p className="kicker text-body">Not found</p>
        <p className="display mt-3 text-[56px] leading-none">No set called “{code.toUpperCase()}”</p>
        <Link href="/" className="prose-link mt-6 inline-block">
          See every set we track
        </Link>
      </main>
    </>
  );
}
