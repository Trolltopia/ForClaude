// Builds the price snapshots the site reads: public/data/<code>.json and index.json.
//
//   npm run data                 # every set in src/sets/catalog.ts
//   npm run data -- fra msh      # just these
//   npm run data -- --report fra # also print each slot and the top cards
//
// Booster structure comes from MTGJSON when it has a Play Booster model for the set,
// otherwise from the hand-written collation in src/sets/rules. Card prices are
// TCGplayer market prices via Scryfall; the box price is TCGplayer's market price for
// the Play Booster display via TCGCSV.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { buildFromMtgjson, buildFromRules, summarise } from "../src/lib/data/build";
import { computeEv, DEFAULT_PARAMS } from "../src/lib/engine/ev";
import type { MtgjsonSetFile } from "../src/lib/data/mtgjson";
import { pickBooster } from "../src/lib/data/mtgjson";
import { createScryfallClient } from "../src/lib/data/scryfall";
import { fetchBoxPrice } from "../src/lib/data/tcgcsv";
import type { SetSummary, Snapshot, SnapshotIndex } from "../src/lib/types";
import { CATALOG, type CatalogEntry } from "../src/sets/catalog";

const OUT = join(import.meta.dirname, "..", "public", "data");
const USER_AGENT = "CrackOrKeep/0.1 (+https://github.com/Trolltopia/ForClaude)";
const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };

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

async function buildSet(entry: CatalogEntry): Promise<Snapshot> {
  const file = await mtgjson(entry.code);
  const picked = file ? pickBooster(file.data) : null;
  let snapshot: Snapshot | null = null;

  // Prefer a hand-written collation over MTGJSON's older booster types: a set that only
  // has "draft" data in MTGJSON but a Play Booster rules file is better modelled by the rules.
  const useRules = entry.rules && (!picked || picked.name !== "play");
  if (file && picked && !useRules) {
    const extraCodes = (picked.config.sourceSetCodes ?? []).filter((c) => c.toUpperCase() !== entry.code.toUpperCase());
    const extras = (await Promise.all(extraCodes.map(mtgjson))).filter((f): f is MtgjsonSetFile => f != null);
    snapshot = await buildFromMtgjson(entry, file, extras, scryfall);
  }
  if (!snapshot && entry.rules) snapshot = await buildFromRules(entry, scryfall);
  if (!snapshot) throw new Error("no MTGJSON booster data and no rules config");

  try {
    const box = await fetchBoxPrice(entry.code, snapshot.name, tcgFetch);
    if (box) {
      snapshot.boxPrice = box;
      snapshot.sources.push({ label: "TCGCSV — TCGplayer sealed product prices", url: "https://tcgcsv.com" });
    } else {
      snapshot.notes.push("No TCGplayer market price found for the Play Booster display; using an estimate.");
    }
  } catch (err) {
    snapshot.notes.push("TCGplayer box price unavailable today; using an estimate.");
    console.warn(`  box price failed: ${(err as Error).message}`);
  }
  return snapshot;
}

/** A plain-text breakdown for eyeballing a snapshot in CI logs. */
function report(snapshot: Snapshot) {
  const ev = computeEv(snapshot, DEFAULT_PARAMS);
  const pad = (s: string, n: number) => s.slice(0, n).padEnd(n);
  const usd = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
  console.log(`    layouts: ${snapshot.model.variants.length}, priced: ${(ev.pricedShare * 100).toFixed(1)}%`);
  for (const s of ev.sheets) {
    console.log(
      `    ${pad(s.label, 34)} ${s.perPack.toFixed(2).padStart(5)}/pack  ${String(s.distinctCards).padStart(4)} cards  avg ${usd(s.avgValue).padStart(8)}  box ${usd(s.evBox).padStart(9)}  ${(s.share * 100).toFixed(1).padStart(5)}%`,
    );
  }
  for (const c of ev.cards.slice(0, 8)) {
    console.log(
      `    top: ${pad(`${c.card.name} [${c.card.set} ${c.card.cn}]${c.foil ? " foil" : ""}`, 46)} ${usd(c.price).padStart(9)}  1 in ${Math.round(1 / c.perPack)} packs  adds ${usd(c.evBox)}`,
    );
  }
  for (const n of snapshot.notes) console.log(`    note: ${n}`);
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
    previous = (JSON.parse(await readFile(join(OUT, "index.json"), "utf8")) as SnapshotIndex).sets;
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
      console.log(
        `  ${snapshot.modelSource.kind}, ${snapshot.cards.length} cards, EV $${summary.evBox.toFixed(2)}/box, ` +
          `box $${snapshot.boxPrice.usd ?? "?"} (${snapshot.boxPrice.source}), ${((Date.now() - started) / 1000).toFixed(1)}s`,
      );
      if (verbose) report(snapshot);
    } catch (err) {
      failures++;
      console.warn(`  skipped: ${(err as Error).message}`);
    }
  }

  const order = new Map(CATALOG.map((e, i) => [e.code, i]));
  const index: SnapshotIndex = {
    version: 1,
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
