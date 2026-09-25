import { useMemo } from "react";
import { RarityPip, RARITY_LABEL } from "@/components/RarityPip";
import { Button } from "@/components/ui/button";
import { priceOf } from "@/lib/engine/ev";
import { ago, money, percent, stamp } from "@/lib/format";
import type { Rarity, Snapshot } from "@/lib/types";

interface Group {
  rarity: Rarity;
  treatment: string;
  foil: boolean;
  share: number;
  cards: number;
  avgPrice: number | null;
}

/** Collapse a sheet's entries into rarity × treatment × finish groups, e.g. "Borderless mythic, foil: 0.2%". */
function groupSheet(snapshot: Snapshot, key: string): Group[] {
  const sheet = snapshot.model.sheets[key];
  const total = sheet.entries.reduce((s, e) => s + e[1], 0);
  const groups = new Map<string, Group & { priced: number; priceSum: number; ids: Set<number> }>();
  for (const [i, w, f] of sheet.entries) {
    const card = snapshot.cards[i];
    if (!card) continue;
    const k = `${card.rarity}|${card.treatmentLabel}|${f}`;
    let g = groups.get(k);
    if (!g) {
      g = { rarity: card.rarity, treatment: card.treatmentLabel, foil: f === 1, share: 0, cards: 0, avgPrice: null, priced: 0, priceSum: 0, ids: new Set() };
      groups.set(k, g);
    }
    g.share += w / total;
    g.ids.add(i);
    const p = priceOf(card, f === 1);
    if (p != null) {
      g.priced++;
      g.priceSum += p;
    }
  }
  return [...groups.values()]
    .map((g) => ({ ...g, cards: g.ids.size, avgPrice: g.priced ? g.priceSum / g.priced : null }))
    .sort((a, b) => b.share - a.share);
}

function groupLabel(g: Group): string {
  const rarity = RARITY_LABEL[g.rarity].toLowerCase();
  const base =
    g.treatment === "Special Guest" ? "Special Guest" : g.treatment === "Regular" ? RARITY_LABEL[g.rarity] : `${g.treatment} ${rarity}`;
  return g.foil ? `${base}, foil` : base;
}

export function ModelDetails({
  snapshot,
  live,
  refreshing,
  onRefresh,
  error,
}: {
  snapshot: Snapshot;
  live: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  error: string | null;
}) {
  const variantTotal = snapshot.model.variants.reduce((s, v) => s + v.weight, 0);
  const sheetOrder = useMemo(() => {
    const seen: string[] = [];
    for (const v of snapshot.model.variants) for (const k of Object.keys(v.contents)) if (!seen.includes(k)) seen.push(k);
    return seen.filter((k) => snapshot.model.sheets[k]?.entries.length);
  }, [snapshot]);

  return (
    <div className="grid gap-14 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0">
        {snapshot.model.variants.length > 1 && (
          <div className="mb-12">
            <h3 className="kicker mb-3">Pack layouts</h3>
            <table className="w-full border-collapse text-[14px]">
              <tbody>
                {[...snapshot.model.variants]
                  .sort((a, b) => b.weight - a.weight)
                  .map((v, i) => (
                    <tr key={i} className="border-b border-hairline align-top">
                      <td className="num w-20 py-2 pr-4 font-semibold">{percent(v.weight / variantTotal, v.weight / variantTotal < 0.1 ? 1 : 0)}</td>
                      <td className="py-2 text-body">
                        {Object.entries(v.contents)
                          .map(([k, n]) => `${n} × ${snapshot.model.sheets[k]?.label ?? k}`)
                          .join(" · ")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        <h3 className="kicker mb-3">What each slot can hold</h3>
        <div className="space-y-10">
          {sheetOrder.map((key) => {
            const count = snapshot.model.variants[0]?.contents[key];
            return (
              <div key={key}>
                <div className="flex items-baseline justify-between gap-4 border-b border-ink pb-2">
                  <h4 className="font-sans text-[17px] font-bold">{snapshot.model.sheets[key].label}</h4>
                  {count != null && snapshot.model.variants.length === 1 && (
                    <span className="kicker text-body">{count === 1 ? "1 card" : `${count} cards`} a pack</span>
                  )}
                </div>
                <table className="w-full border-collapse text-[14px]">
                  <thead className="sr-only">
                    <tr>
                      <th>Kind of card</th>
                      <th>Chance</th>
                      <th>Cards</th>
                      <th>Average price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupSheet(snapshot, key).map((g) => (
                      <tr key={`${g.rarity}${g.treatment}${g.foil}`} className="border-b border-hairline">
                        <td className="py-2 pr-4">
                          <RarityPip rarity={g.rarity} />
                          <span className="ml-2">{groupLabel(g)}</span>
                        </td>
                        <td className="num w-20 py-2 text-right font-semibold">{percent(g.share, g.share < 0.1 ? 1 : 0)}</td>
                        <td className="num w-24 py-2 text-right text-body">{g.cards} cards</td>
                        <td className="num w-28 py-2 text-right text-body">avg {money(g.avgPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>

      <aside className="space-y-10 text-[14px]">
        <div>
          <h3 className="kicker mb-3">Prices</h3>
          <p className="text-body">
            {live ? "Fetched from Scryfall in your browser" : "Daily snapshot"}, {stamp(snapshot.generatedAt)} ({ago(snapshot.generatedAt)}).
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Fetching prices…" : "Refresh from Scryfall"}
          </Button>
          {error && <p className="mt-3 text-bad">{error}</p>}
        </div>
        <div>
          <h3 className="kicker mb-3">Booster model</h3>
          <p className="text-body">
            {snapshot.modelSource.kind === "mtgjson"
              ? `Print sheets and pack layouts from MTGJSON's “${snapshot.modelSource.boosterName}” booster data.`
              : "Slot odds transcribed from Wizards of the Coast's published collation for this set."}
          </p>
        </div>
        {snapshot.notes.length > 0 && (
          <div>
            <h3 className="kicker mb-3">Notes</h3>
            <ul className="list-disc space-y-2 pl-4 text-body marker:text-muted">
              {snapshot.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <h3 className="kicker mb-3">Sources</h3>
          <ul className="space-y-2">
            {snapshot.sources.map((s) => (
              <li key={s.url}>
                <a className="prose-link" href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
