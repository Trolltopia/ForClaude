import { useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Section } from "@/components/Section";
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
import { computeEv, DEFAULT_FEES, type EvParams } from "@/lib/engine/ev";
import { count, isReleased, money, percent } from "@/lib/format";
import { catalogEntry } from "@/sets/catalog";

const QUERY_KEYS = ["box", "floor", "fees"] as const;

export function SetPage({ code }: { code: string }) {
  const entry = catalogEntry(code);
  const { status, snapshot, live, refreshing, error, refresh } = useSnapshot(code);
  const [query, setQuery] = useQueryNumbers(QUERY_KEYS);

  const defaultFees = Math.round(DEFAULT_FEES * 100);
  const floor = Math.max(0, Math.min(1000, query.floor ?? 0));
  const fees = Math.max(0, Math.min(30, query.fees ?? defaultFees));
  const params = useMemo<EvParams>(() => ({ floor, fees: fees / 100 }), [floor, fees]);
  const marketPrice = snapshot?.boxPrice ?? { usd: entry?.boxEstimate ?? null, source: "estimate" as const };
  const boxPrice = query.box ?? marketPrice.usd;

  const ev = useMemo(() => (snapshot ? computeEv(snapshot, params) : null), [snapshot, params]);
  const { summary: sim, running } = useSimulation(snapshot, params, boxPrice);

  useEffect(() => {
    const name = snapshot?.name ?? entry?.name;
    document.title = name ? `${name} booster box value — Crack or Keep` : "Crack or Keep";
  }, [snapshot?.name, entry?.name]);

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

            <Controls
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
                {percent(1 - ev.pricedShare)} of the cards you can open have no market price yet and count as zero.
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
                  What the set sells for unopened, from single packs to cases. Anything made of Play Boosters is priced per booster
                  against the <strong className="font-semibold text-ink">{money(ev.evPack)}</strong> an average pack is worth at your
                  settings.
                </>
              }
            >
              {snapshot.sealed?.length ? (
                <SealedSection
                  products={snapshot.sealed}
                  evPack={ev.evPack}
                  packsPerBox={snapshot.product.packsPerBox}
                  boxPrice={boxPrice}
                  onUseAsBox={(v) => setQuery({ box: v })}
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

            <Section id="cards" number="05" rail="Card list" title="Every card you can open" dek="Sorted by what each card adds to an average box. “You keep” is the price after your selling fees; cards under your floor show as bulk. Hover a name to see the card.">
              <CardTable cards={ev.cards} />
            </Section>

            <Section
              id="model"
              number="06"
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
