// Builds the price snapshots the site reads: public/data/<code>.json and index.json.
//
//   npm run data                 # every set in src/sets/catalog.ts
//   npm run data -- fra msh      # just these
//   npm run data -- --report fra # also print each slot and the top cards
//
// Each set gets every booster it was sold in (Play or Draft, Set, Collector). Booster
// structure comes from MTGJSON's print sheets where it has them, otherwise from the
// hand-written collations in src/sets/rules. Card prices are TCGplayer market prices via
// Scryfall; box prices are TCGplayer's market prices for each display via TCGCSV.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { BOOSTER_NAME, boosterView, upgradeIndex } from "../src/lib/boosters";
import { buildSetSnapshot, summarise } from "../src/lib/data/build";
import { sealedBoosters, type MtgjsonSetFile } from "../src/lib/data/mtgjson";
import { createScryfallClient } from "../src/lib/data/scryfall";
import { fetchSealed, type Displays } from "../src/lib/data/tcgcsv";
import { computeEv, DEFAULT_PARAMS, MARKET_PARAMS } from "../src/lib/engine/ev";
import type { SetSnapshot, SetSummary, Snapshot, SnapshotIndex } from "../src/lib/types";
import { CATALOG, type CatalogEntry } from "../src/sets/catalog";

const OUT = join(import.meta.dirname, "..", "public", "data");
const USER_AGENT = "CrackOrKeep/0.1 (+https://github.com/Trolltopia/ForClaude)";
const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };

// Scryfall allows about two requests a second to /cards/collection; stay under it.
const scryfall = createScryfallClient({ delayMs: 550, headers });
const mtgjsonCache = new Map<string, Promise<MtgjsonSetFile | null>>();

// Set files run to tens of megabytes; the gzipped copies are a tenth of that.
async function downloadMtgjson(code: string): Promise<MtgjsonSetFile | null> {
  try {
    const gz = await fetch(`https://mtgjson.com/api/v5/${code}.json.gz`, { headers });
    if (gz.ok) return JSON.parse(gunzipSync(Buffer.from(await gz.arrayBuffer())).toString("utf8")) as MtgjsonSetFile;
    const plain = await fetch(`https://mtgjson.com/api/v5/${code}.json`, { headers });
    return plain.ok ? ((await plain.json()) as MtgjsonSetFile) : null;
  } catch (err) {
    console.warn(`  MTGJSON ${code} unavailable: ${(err as Error).message}`);
    return null;
  }
}

function mtgjson(code: string): Promise<MtgjsonSetFile | null> {
  const key = code.toUpperCase();
  if (!mtgjsonCache.has(key)) mtgjsonCache.set(key, downloadMtgjson(key));
  return mtgjsonCache.get(key)!;
}

// TCGCSV's group list is the same for every set; fetch it once per run.
const tcgCache = new Map<string, Promise<Response>>();
function tcgFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!tcgCache.has(url)) {
    tcgCache.set(
      url,
      fetch(url, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } }),
    );
  }
  return tcgCache.get(url)!.then((r) => r.clone());
}

async function buildSet(entry: CatalogEntry): Promise<SetSnapshot> {
  const snapshot = await buildSetSnapshot(entry, { client: scryfall, mtgjson });
  const file = await mtgjson(entry.code);
  const available = Object.keys(file?.data.booster ?? {});
  if (available.length) console.log(`  MTGJSON boosters: ${available.join(", ")}`);

  // What's in each display, from MTGJSON's sealed records where it has them.
  const known = file ? sealedBoosters(file.data) : undefined;
  const displays: Displays = {};
  for (const spec of entry.boosters) {
    const recorded = known?.displays[spec.type];
    if (recorded != null && recorded !== spec.packsPerBox) {
      console.warn(`  ${spec.type} display: MTGJSON records ${recorded} packs, the catalog says ${spec.packsPerBox}; using ${recorded}`);
    }
    displays[spec.type] = recorded ?? spec.packsPerBox;
  }
  for (const booster of snapshot.boosters) booster.packsPerBox = displays[booster.type] ?? booster.packsPerBox;

  try {
    const { boxes, products } = await fetchSealed(
      { code: entry.code, name: snapshot.name, releasedAt: snapshot.releasedAt, displays, known },
      tcgFetch,
    );
    snapshot.sealed = products;
    if (products.length) snapshot.sources.push({ label: "TCGCSV — TCGplayer sealed product prices", url: "https://tcgcsv.com" });
    for (const booster of snapshot.boosters) {
      const box = boxes[booster.type];
      if (box) booster.boxPrice = box;
      else booster.notes.push(`No TCGplayer market price found for the ${booster.name} display${booster.boxPrice.usd != null ? "; using an estimate" : ""}.`);
    }
  } catch (err) {
    snapshot.notes.push("TCGplayer sealed prices unavailable today; box prices are estimates.");
    console.warn(`  sealed prices failed: ${(err as Error).message}`);
  }
  return snapshot;
}

/** A plain-text breakdown of one booster, for eyeballing a snapshot in CI logs. */
function report(snapshot: Snapshot) {
  const ev = computeEv(snapshot, MARKET_PARAMS);
  const site = computeEv(snapshot, DEFAULT_PARAMS);
  const bulk = computeEv(snapshot, { floor: 0.25, fees: DEFAULT_PARAMS.fees });
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  const usd = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
  const box = snapshot.boxPrice.usd;
  console.log(
    `  ${snapshot.product.name}: ${snapshot.product.packsPerBox} packs/box, ${snapshot.product.cardsPerPack ?? "?"} cards/pack, ` +
      `layouts: ${snapshot.model.variants.length}, priced: ${(ev.pricedShare * 100).toFixed(1)}%, ` +
      `box ${usd(box)} (${snapshot.boxPrice.source}${snapshot.boxPrice.productName ? `: ${snapshot.boxPrice.productName}` : ""})`,
  );
  const x = (v: number) => (box ? `${(box / v).toFixed(2)}x` : "?");
  console.log(
    `    market ${usd(ev.evBox)} (${x(ev.evBox)}) · after 8% fees ${usd(site.evBox)} (${x(site.evBox)}) · also ignoring < 25¢ ${usd(bulk.evBox)} (${x(bulk.evBox)})`,
  );
  for (const s of ev.sheets) {
    console.log(
      `    ${pad(s.label, 34)} ${s.perPack.toFixed(2).padStart(5)}/pack  ${String(s.distinctCards).padStart(4)} cards  avg ${usd(s.avgValue).padStart(8)}  box ${usd(s.evBox).padStart(9)}  ${(s.share * 100).toFixed(1).padStart(5)}%`,
    );
  }
  for (const c of ev.cards.slice(0, 6)) {
    console.log(
      `    top: ${pad(`${c.card.name} [${c.card.set} ${c.card.cn}]${c.foil ? " foil" : ""}`, 46)} ${usd(c.price).padStart(9)}  1 in ${Math.round(1 / c.perPack)} packs  adds ${usd(c.evBox)}`,
    );
  }
}

function reportSet(snapshot: SetSnapshot) {
  const usd = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
  for (const booster of snapshot.boosters) report(boosterView(snapshot, booster));
  for (const s of snapshot.sealed ?? []) {
    const inside = s.packs ? ` = ${s.packs} × ${BOOSTER_NAME[s.booster!]}` : "";
    console.log(`    sealed: ${s.kind.padEnd(26)} ${usd(s.market).padStart(9)}  low ${usd(s.low).padStart(9)}  ${s.name}${inside}`);
  }
  for (const n of [...snapshot.notes, ...snapshot.boosters.flatMap((b) => b.notes.map((x) => `${b.name}: ${x}`))]) console.log(`    note: ${n}`);
}

async function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes("--report");
  const wanted = args.filter((a) => !a.startsWith("--")).map((s) => s.toLowerCase());
  const entries = wanted.length ? CATALOG.filter((e) => wanted.includes(e.code)) : CATALOG;
  await mkdir(OUT, { recursive: true });

  // Keep summaries for sets we don't rebuild this run, so a partial run doesn't empty the board.
  let previous: SetSummary[] = [];
  try {
    previous = upgradeIndex(JSON.parse(await readFile(join(OUT, "index.json"), "utf8"))).sets;
  } catch {
    previous = [];
  }

  const summaries = new Map(previous.map((s) => [s.code, s]));
  let failures = 0;
  for (const entry of entries) {
    const started = Date.now();
    console.log(`${entry.code.toUpperCase()} ${entry.name}`);
    try {
      const snapshot = await buildSet(entry);
      await writeFile(join(OUT, `${entry.code}.json`), JSON.stringify(snapshot));
      const summary = summarise(snapshot);
      summaries.set(entry.code, summary);
      const lines = summary.boosters.map(
        (b) => `${b.name} EV $${b.evBox.toFixed(2)}/box vs $${b.boxPrice.usd ?? "?"} (${b.boxPrice.source}, ${b.modelSource})`,
      );
      console.log(`  ${snapshot.cards.length} cards · ${lines.join(" · ")} · ${((Date.now() - started) / 1000).toFixed(1)}s`);
      if (verbose) reportSet(snapshot);
    } catch (err) {
      failures++;
      console.warn(`  skipped: ${(err as Error).message}`);
    }
  }

  const order = new Map(CATALOG.map((e, i) => [e.code, i]));
  const index: SnapshotIndex = {
    version: 2,
    generatedAt: new Date().toISOString(),
    sets: [...summaries.values()].filter((s) => order.has(s.code)).sort((a, b) => order.get(a.code)! - order.get(b.code)!),
  };
  await writeFile(join(OUT, "index.json"), JSON.stringify(index, null, 1));
  console.log(`Wrote ${index.sets.length} sets to ${OUT}${failures ? ` (${failures} failed)` : ""}`);
  if (index.sets.length === 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
