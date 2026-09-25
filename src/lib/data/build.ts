import { computeEv, DEFAULT_PARAMS, mostValuable } from "../engine/ev";
import type { BoxPrice, CardRecord, SetSummary, Snapshot, Source } from "../types";
import type { CatalogEntry } from "@/sets/catalog";
import { buildModelFromMtgjson, pickBooster, remapModel, type MtgjsonSetFile } from "./mtgjson";
import { buildModelFromRules, rulesQueries } from "./rules";
import { normaliseCard, type ScryfallClient, type ScryfallSet } from "./scryfall";

export const BASE_SOURCES: Source[] = [
  { label: "Scryfall — card data and TCGplayer market prices", url: "https://scryfall.com/docs/api" },
];

function estimateBox(entry: CatalogEntry): BoxPrice {
  return { usd: entry.boxEstimate, source: "estimate" };
}

function baseSnapshot(entry: CatalogEntry, set: ScryfallSet | null): Omit<Snapshot, "model" | "modelSource" | "cards"> {
  return {
    version: 1,
    code: entry.code,
    name: set?.name ?? entry.name,
    releasedAt: set?.released_at ?? entry.releasedAt,
    iconSvg: set?.icon_svg_uri ?? null,
    product: { name: "Play Booster", packsPerBox: entry.packsPerBox, cardsPerPack: null },
    boxPrice: estimateBox(entry),
    generatedAt: new Date().toISOString(),
    sources: [...BASE_SOURCES],
    notes: [],
  };
}

async function safeSet(client: ScryfallClient, code: string): Promise<ScryfallSet | null> {
  try {
    return await client.set(code);
  } catch {
    return null;
  }
}

/** Build a snapshot from a hand-written collation and a live Scryfall search. */
export async function buildFromRules(entry: CatalogEntry, client: ScryfallClient): Promise<Snapshot> {
  if (!entry.rules) throw new Error(`${entry.code} has no rules config`);
  const set = await safeSet(client, entry.code);
  const seen = new Set<string>();
  const cards: CardRecord[] = [];
  for (const q of rulesQueries(entry.rules, entry.code)) {
    for (const raw of await client.search(q)) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      cards.push(normaliseCard(raw));
    }
  }
  const { model, cards: labelled, emptySheets } = buildModelFromRules(entry.rules, cards, entry.code);

  // Drop cards no sheet can produce so the snapshot stays small.
  const used = new Set<number>();
  for (const sheet of Object.values(model.sheets)) for (const [i] of sheet.entries) used.add(i);
  const kept: CardRecord[] = [];
  const remap = new Map<number, number>();
  labelled.forEach((c, i) => {
    if (used.has(i)) {
      remap.set(i, kept.length);
      kept.push(c);
    }
  });

  const base = baseSnapshot(entry, set);
  const notes = [...(entry.rules.notes ?? [])];
  for (const key of emptySheets) {
    notes.push(`No cards found yet for "${entry.rules.sheets[key].label}"; its share of each slot is spread over the other outcomes.`);
  }
  return {
    ...base,
    product: { ...base.product, cardsPerPack: entry.rules.slots.reduce((s, x) => s + x.count, 0) },
    model: remapModel(model, (i) => remap.get(i)),
    modelSource: { kind: "rules", note: "Slot odds transcribed from the published collation." },
    cards: kept,
    sources: [...entry.rules.sources, ...base.sources],
    notes,
  };
}

/** Build a snapshot from MTGJSON's booster sheets, priced through Scryfall. */
export async function buildFromMtgjson(
  entry: CatalogEntry,
  setFile: MtgjsonSetFile,
  extraSets: MtgjsonSetFile[],
  client: ScryfallClient,
): Promise<Snapshot | null> {
  const picked = pickBooster(setFile.data);
  if (!picked) return null;

  const uuidToScryfall = new Map<string, string>();
  for (const file of [setFile, ...extraSets]) {
    for (const c of [...file.data.cards, ...(file.data.tokens ?? [])]) {
      if (c.identifiers?.scryfallId) uuidToScryfall.set(c.uuid, c.identifiers.scryfallId);
    }
  }

  const { model, scryfallIds, missing } = buildModelFromMtgjson(picked.config, uuidToScryfall);
  const found = new Map((await client.collection(scryfallIds)).map((c) => [c.id, normaliseCard(c)]));

  const cards: CardRecord[] = [];
  const remap = new Map<number, number>();
  scryfallIds.forEach((id, i) => {
    const card = found.get(id);
    if (card) {
      remap.set(i, cards.length);
      cards.push(card);
    }
  });

  const set = await safeSet(client, entry.code);
  const base = baseSnapshot(entry, set);
  const contents = picked.config.boosters[0]?.contents ?? {};
  const notes: string[] = [];
  const unresolved = missing.length + (scryfallIds.length - cards.length);
  if (unresolved > 0) notes.push(`${unresolved} sheet entries could not be matched to a Scryfall card and were left out.`);

  return {
    ...base,
    product: {
      name: picked.config.name ?? `${picked.name[0].toUpperCase()}${picked.name.slice(1)} Booster`,
      packsPerBox: entry.packsPerBox,
      cardsPerPack: Object.values(contents).reduce((s, n) => s + n, 0) || null,
    },
    model: remapModel(model, (i) => remap.get(i)),
    modelSource: { kind: "mtgjson", boosterName: picked.name },
    cards,
    sources: [
      { label: "MTGJSON — booster sheets and weights", url: `https://mtgjson.com/api/v5/${entry.code.toUpperCase()}.json` },
      ...base.sources,
    ],
    notes,
  };
}

function withFreshPrices(snapshot: Snapshot, fresh: Map<string, CardRecord>): Snapshot {
  return {
    ...snapshot,
    cards: snapshot.cards.map((c) => {
      const f = fresh.get(c.id);
      return f ? { ...c, prices: f.prices, image: f.image ?? c.image } : c;
    }),
    generatedAt: new Date().toISOString(),
  };
}

/** Pull fresh prices for every card in a snapshot. Cards Scryfall no longer returns keep their old price. */
export async function refreshPrices(snapshot: Snapshot, client: ScryfallClient): Promise<Snapshot> {
  const fresh = new Map((await client.collection(snapshot.cards.map((c) => c.id))).map((c) => [c.id, normaliseCard(c)]));
  return withFreshPrices(snapshot, fresh);
}

/**
 * The same refresh using only GET searches. Browsers must preflight the JSON POST that
 * /cards/collection needs; plain GETs avoid that round trip and any CORS surprises.
 */
export async function refreshPricesViaSearch(snapshot: Snapshot, client: ScryfallClient): Promise<Snapshot> {
  const bySet = new Map<string, CardRecord[]>();
  for (const c of snapshot.cards) bySet.set(c.set, [...(bySet.get(c.set) ?? []), c]);
  const fresh = new Map<string, CardRecord>();
  for (const [set, cards] of bySet) {
    for (const q of searchQueriesFor(set, cards.map((c) => c.cn))) {
      for (const raw of await client.search(q)) fresh.set(raw.id, normaliseCard(raw));
    }
  }
  return withFreshPrices(snapshot, fresh);
}

/** Whole-set search for sets we mostly use; collector-number lists for a few cards from a big shared set. */
export function searchQueriesFor(set: string, cns: string[], chunk = 40): string[] {
  if (cns.length > 120) return [`e:${set}`];
  const term = (cn: string) => (/^[0-9a-z]+$/i.test(cn) ? `cn:${cn}` : `cn:"${cn.replace(/"/g, "")}"`);
  const out: string[] = [];
  for (let i = 0; i < cns.length; i += chunk) out.push(`e:${set} (${cns.slice(i, i + chunk).map(term).join(" or ")})`);
  return out;
}

export function summarise(snapshot: Snapshot): SetSummary {
  const ev = computeEv(snapshot, DEFAULT_PARAMS);
  const top = mostValuable(snapshot);
  const price = snapshot.boxPrice.usd;
  return {
    code: snapshot.code,
    name: snapshot.name,
    releasedAt: snapshot.releasedAt,
    iconSvg: snapshot.iconSvg,
    packsPerBox: snapshot.product.packsPerBox,
    boxPrice: snapshot.boxPrice,
    evBox: round2(ev.evBox),
    evPack: round2(ev.evPack),
    ratio: price && ev.evBox > 0 ? round2(price / ev.evBox, 3) : null,
    pricedShare: round2(ev.pricedShare, 3),
    topCard: top
      ? {
          name: top.card.name,
          price: top.price,
          foil: top.foil,
          image: top.card.image,
          treatmentLabel: top.card.treatmentLabel,
        }
      : null,
    modelSource: snapshot.modelSource.kind,
  };
}

function round2(n: number, digits = 2) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
