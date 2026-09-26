import { boosterName, boosterView, byBoosterOrder } from "../boosters";
import { computeEv, DEFAULT_PARAMS, mostValuable } from "../engine/ev";
import type { BoosterProduct, BoosterSummary, BoxPrice, CardRecord, SetSnapshot, SetSummary, Snapshot, Source } from "../types";
import type { BoosterSpec, CatalogEntry } from "@/sets/catalog";
import { boosterConfig, buildModelFromMtgjson, remapModel, type MtgjsonSetFile } from "./mtgjson";
import { buildModelFromRules, rulesQueries } from "./rules";
import { normaliseCard, type ScryfallClient, type ScryfallSet } from "./scryfall";

export const BASE_SOURCES: Source[] = [
  { label: "Scryfall — card data and TCGplayer market prices", url: "https://scryfall.com/docs/api" },
];

/** The cards every booster of a set can produce, one entry per Scryfall id. */
export class CardPool {
  readonly cards: CardRecord[] = [];
  private readonly at = new Map<string, number>();

  indexOf(id: string): number | undefined {
    return this.at.get(id);
  }

  /** Add a card, or return where it already is. The first version added wins. */
  add(card: CardRecord): number {
    let i = this.at.get(card.id);
    if (i === undefined) {
      i = this.cards.length;
      this.cards.push(card);
      this.at.set(card.id, i);
    }
    return i;
  }
}

function estimateBox(spec: BoosterSpec): BoxPrice {
  return { usd: spec.estimate ?? null, source: "estimate" };
}

async function safeSet(client: ScryfallClient, code: string): Promise<ScryfallSet | null> {
  try {
    return await client.set(code);
  } catch {
    return null;
  }
}

/** A booster built from a hand-written collation and a live Scryfall search. */
async function rulesBooster(entry: CatalogEntry, spec: BoosterSpec, client: ScryfallClient, pool: CardPool): Promise<BoosterProduct> {
  const rules = spec.rules!;
  const seen = new Set<string>();
  const cards: CardRecord[] = [];
  for (const q of rulesQueries(rules, entry.code)) {
    for (const raw of await client.search(q)) {
      if (seen.has(raw.id)) continue;
      seen.add(raw.id);
      cards.push(normaliseCard(raw));
    }
  }
  const { model, cards: labelled, emptySheets } = buildModelFromRules(rules, cards, entry.code);

  // Only cards some sheet can produce go into the pool, so the snapshot stays small.
  const remap = new Map<number, number>();
  for (const sheet of Object.values(model.sheets)) {
    for (const [i] of sheet.entries) if (!remap.has(i)) remap.set(i, pool.add(labelled[i]));
  }

  const notes = [...(rules.notes ?? [])];
  for (const key of emptySheets) {
    notes.push(`No cards found yet for "${rules.sheets[key].label}"; its share of each slot is spread over the other outcomes.`);
  }
  return {
    type: spec.type,
    name: boosterName(spec.type, entry.releasedAt),
    packsPerBox: spec.packsPerBox,
    cardsPerPack: rules.slots.reduce((s, x) => s + x.count, 0),
    boxPrice: estimateBox(spec),
    model: remapModel(model, (i) => remap.get(i)),
    modelSource: { kind: "rules", note: "Slot odds transcribed from the published collation." },
    notes,
  };
}

/** Boosters built from MTGJSON's print sheets, with one Scryfall lookup for all of them. */
async function mtgjsonBoosters(
  entry: CatalogEntry,
  specs: BoosterSpec[],
  setFile: MtgjsonSetFile,
  extraSets: MtgjsonSetFile[],
  client: ScryfallClient,
  pool: CardPool,
): Promise<BoosterProduct[]> {
  const uuidToScryfall = new Map<string, string>();
  for (const file of [setFile, ...extraSets]) {
    for (const c of [...file.data.cards, ...(file.data.tokens ?? [])]) {
      if (c.identifiers?.scryfallId) uuidToScryfall.set(c.uuid, c.identifiers.scryfallId);
    }
  }

  const built = specs.flatMap((spec) => {
    const picked = boosterConfig(setFile.data, spec.type);
    return picked ? [{ spec, picked, ...buildModelFromMtgjson(picked.config, uuidToScryfall) }] : [];
  });

  const wanted = [...new Set(built.flatMap((b) => b.scryfallIds))].filter((id) => pool.indexOf(id) === undefined);
  for (const raw of wanted.length ? await client.collection(wanted) : []) pool.add(normaliseCard(raw));

  return built.map(({ spec, picked, model, scryfallIds, missing }) => {
    const unresolved = missing.length + scryfallIds.filter((id) => pool.indexOf(id) === undefined).length;
    const contents = picked.config.boosters[0]?.contents ?? {};
    return {
      type: spec.type,
      name: boosterName(spec.type, entry.releasedAt),
      packsPerBox: spec.packsPerBox,
      cardsPerPack: Object.values(contents).reduce((s, n) => s + n, 0) || null,
      boxPrice: estimateBox(spec),
      model: remapModel(model, (i) => pool.indexOf(scryfallIds[i])),
      modelSource: { kind: "mtgjson", boosterName: picked.name },
      notes: unresolved > 0 ? [`${unresolved} sheet entries could not be matched to a Scryfall card and were left out.`] : [],
    };
  });
}

export interface BuildDeps {
  client: ScryfallClient;
  /** An MTGJSON set file by code, or null when there isn't one. Leave out to build from rules only. */
  mtgjson?: (code: string) => Promise<MtgjsonSetFile | null>;
}

/**
 * Build a snapshot with every booster in the catalog entry that MTGJSON or a hand-written
 * collation can model. MTGJSON wins when it has the booster; rules fill the gaps, such as
 * a set's Play Booster in the weeks before MTGJSON adds it.
 */
export async function buildSetSnapshot(entry: CatalogEntry, deps: BuildDeps): Promise<SetSnapshot> {
  const file = deps.mtgjson ? await deps.mtgjson(entry.code) : null;
  const viaMtgjson = file ? entry.boosters.filter((spec) => boosterConfig(file.data, spec.type)) : [];
  const viaRules = entry.boosters.filter((spec) => spec.rules && !viaMtgjson.includes(spec));
  const pool = new CardPool();
  const boosters: BoosterProduct[] = [];
  const sources: Source[] = [];

  // Rules first, so their treatment labels win for cards both kinds of model share.
  for (const spec of viaRules) {
    boosters.push(await rulesBooster(entry, spec, deps.client, pool));
    sources.push(...spec.rules!.sources);
  }
  if (file && viaMtgjson.length) {
    const extraCodes = new Set(
      viaMtgjson
        .flatMap((spec) => boosterConfig(file.data, spec.type)!.config.sourceSetCodes ?? [])
        .map((c) => c.toUpperCase())
        .filter((c) => c !== entry.code.toUpperCase()),
    );
    const extras = (await Promise.all([...extraCodes].map((c) => deps.mtgjson!(c)))).filter((f): f is MtgjsonSetFile => f != null);
    boosters.push(...(await mtgjsonBoosters(entry, viaMtgjson, file, extras, deps.client, pool)));
    sources.unshift({ label: "MTGJSON — booster sheets and weights", url: `https://mtgjson.com/api/v5/${entry.code.toUpperCase()}.json` });
  }
  if (!boosters.length) throw new Error("no MTGJSON booster data and no rules config");
  boosters.sort(byBoosterOrder);

  const notes: string[] = [];
  const unmodelled = entry.boosters.filter((spec) => !boosters.some((b) => b.type === spec.type));
  if (unmodelled.length) {
    const names = unmodelled.map((spec) => `${boosterName(spec.type, entry.releasedAt)}s`).join(" and ");
    notes.push(`${names} aren't priced yet: MTGJSON hasn't published their print sheets. They'll appear here once it does.`);
  }

  const set = await safeSet(deps.client, entry.code);
  return {
    version: 2,
    code: entry.code,
    name: set?.name ?? entry.name,
    releasedAt: set?.released_at ?? entry.releasedAt,
    iconSvg: set?.icon_svg_uri ?? null,
    boosters,
    cards: pool.cards,
    generatedAt: new Date().toISOString(),
    sources: uniqueSources([...sources, ...BASE_SOURCES]),
    notes,
  };
}

function uniqueSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => !seen.has(s.url) && seen.add(s.url));
}

type Priced = { cards: CardRecord[]; generatedAt: string };

function withFreshPrices<T extends Priced>(snapshot: T, fresh: Map<string, CardRecord>): T {
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
export async function refreshPrices<T extends Priced>(snapshot: T, client: ScryfallClient): Promise<T> {
  const fresh = new Map((await client.collection(snapshot.cards.map((c) => c.id))).map((c) => [c.id, normaliseCard(c)]));
  return withFreshPrices(snapshot, fresh);
}

/**
 * The same refresh using only GET searches. Browsers must preflight the JSON POST that
 * /cards/collection needs; plain GETs avoid that round trip and any CORS surprises.
 */
export async function refreshPricesViaSearch<T extends Priced>(snapshot: T, client: ScryfallClient): Promise<T> {
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

export function summarise(set: SetSnapshot): SetSummary {
  return {
    code: set.code,
    name: set.name,
    releasedAt: set.releasedAt,
    iconSvg: set.iconSvg,
    boosters: set.boosters.map((b) => summariseBooster(boosterView(set, b))),
    params: { ...DEFAULT_PARAMS },
  };
}

function summariseBooster(snapshot: Snapshot): BoosterSummary {
  const ev = computeEv(snapshot, DEFAULT_PARAMS);
  const top = mostValuable(snapshot);
  const price = snapshot.boxPrice.usd;
  return {
    type: snapshot.booster,
    name: snapshot.product.name,
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
