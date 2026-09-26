// Lists every set MTGJSON can model a booster for, with the sealed box sizes MTGJSON
// records and whether TCGplayer (via TCGCSV) carries the set. Used to extend the catalog.
//
//   npm run discover                  # one line per set, newest first
//   npm run discover -- --raw lea kld # also the raw sealed-product records for these sets
import { gunzipSync } from "node:zlib";

const USER_AGENT = "CrackOrKeep/0.1 (+https://github.com/Trolltopia/ForClaude)";
const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
const TYPES = new Set(["expansion", "core", "masters", "draft_innovation"]);

interface SetListEntry {
  code: string;
  name: string;
  releaseDate: string;
  type: string;
  isOnlineOnly?: boolean;
  isForeignOnly?: boolean;
  isPartialPreview?: boolean;
  tcgplayerGroupId?: number;
}

interface SealedProduct {
  name: string;
  category?: string;
  subtype?: string;
  productSize?: number;
  cardCount?: number;
  contents?: Record<string, unknown[]> & { card?: unknown[] };
  identifiers?: { tcgplayerProductId?: string };
}

interface SetFile {
  data: {
    booster?: Record<string, { boosters: { contents: Record<string, number>; weight: number }[] }>;
    sealedProduct?: SealedProduct[];
  };
}

async function json<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers });
  if (!res.ok) return null;
  if (url.endsWith(".gz")) return JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8")) as T;
  return (await res.json()) as T;
}

// Windows can't name a file CON, so MTGJSON publishes Conflux as CON_.
const fileCode = (code: string) => (code.toUpperCase() === "CON" ? "CON_" : code.toUpperCase());

/** Packs inside a sealed product, from its contents. */
function packsInside(p: SealedProduct): string {
  const parts: string[] = [];
  for (const [kind, items] of Object.entries(p.contents ?? {})) {
    for (const item of items as Record<string, unknown>[]) {
      const count = typeof item.count === "number" ? item.count : 1;
      const label = String(item.name ?? item.code ?? kind);
      parts.push(`${count}×${kind}:${label}`);
    }
  }
  return parts.join(" + ");
}

/** What MTGJSON offers for fixed-content products: Commander deck lists and Secret Lair drops. */
async function discoverDecks() {
  const list = (await json<{ data: { code: string; fileName: string; name: string; releaseDate: string; type: string }[] }>(
    "https://mtgjson.com/api/v5/DeckList.json",
  ))?.data ?? [];
  const byType = new Map<string, number>();
  for (const d of list) byType.set(d.type, (byType.get(d.type) ?? 0) + 1);
  console.log(`${list.length} decks: ${[...byType].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}`);
  const commander = list.filter((d) => d.type === "Commander Deck").sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  console.log(`Commander decks: ${commander.length}, ${commander.at(-1)?.releaseDate} to ${commander[0]?.releaseDate}`);
  for (const d of commander.slice(0, 3)) console.log(`  ${d.releaseDate} ${d.code} ${d.fileName} ${d.name}`);
  const sample = commander[0];
  if (sample) {
    const deck = await json<{ data: Record<string, unknown> }>(`https://mtgjson.com/api/v5/decks/${sample.fileName}.json`);
    const data = deck?.data ?? {};
    console.log(`Deck file keys: ${Object.keys(data).join(", ")}`);
    for (const board of ["commander", "mainBoard", "sideBoard", "displayCommander", "planes", "schemes", "tokens"]) {
      const cards = data[board] as Record<string, unknown>[] | undefined;
      if (!cards?.length) continue;
      const first = cards[0];
      console.log(`  ${board}: ${cards.length} entries; entry keys: ${Object.keys(first).join(", ")}`);
      console.log(`    first: ${JSON.stringify({ name: first.name, count: first.count, isFoil: first.isFoil, finishes: first.finishes, identifiers: first.identifiers }).slice(0, 400)}`);
    }
    console.log(`  sealedProductUuids: ${JSON.stringify(data.sealedProductUuids ?? null)}`);
  }
  const sld = await json<SetFile & { data: { cards: { uuid: string }[] } }>("https://mtgjson.com/api/v5/SLD.json.gz");
  const sealed = sld?.data.sealedProduct ?? [];
  const cats = new Map<string, number>();
  for (const p of sealed) cats.set(`${p.category}/${p.subtype}`, (cats.get(`${p.category}/${p.subtype}`) ?? 0) + 1);
  console.log(`SLD: ${sld?.data.cards.length ?? 0} cards, ${sealed.length} sealed products: ${[...cats].map(([k, n]) => `${k} ${n}`).join(", ")}`);
  const withCards = sealed.filter((p) => Array.isArray(p.contents?.card) && p.contents!.card!.length);
  const withTcg = sealed.filter((p) => p.identifiers?.tcgplayerProductId);
  console.log(`  with card lists: ${withCards.length}, with TCGplayer ids: ${withTcg.length}`);
  for (const p of withCards.slice(-3)) console.log(`  sample: ${JSON.stringify(p).slice(0, 900)}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--decks")) return discoverDecks();
  const rawIndex = args.indexOf("--raw");
  const raw = rawIndex >= 0 ? new Set(args.slice(rawIndex + 1).map((c) => c.toUpperCase())) : new Set<string>();

  const setList = (await json<{ data: SetListEntry[] }>("https://mtgjson.com/api/v5/SetList.json"))?.data ?? [];
  const groups =
    (await json<{ results: { groupId: number; name: string; abbreviation?: string }[] }>("https://tcgcsv.com/tcgplayer/1/groups"))?.results ?? [];
  const groupIds = new Set(groups.map((g) => g.groupId));
  const groupCodes = new Set(groups.map((g) => g.abbreviation?.toUpperCase()));

  const sets = setList
    .filter((s) => TYPES.has(s.type) && !s.isOnlineOnly && !s.isForeignOnly)
    .sort((a, b) => b.releaseDate.localeCompare(a.releaseDate));
  console.log(`${setList.length} sets in MTGJSON, ${sets.length} paper expansion, core, masters and draft-innovation sets`);

  const queue = [...sets];
  const lines = new Map<string, string>();
  async function worker() {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const file = await json<SetFile>(`https://mtgjson.com/api/v5/${fileCode(s.code)}.json.gz`).catch(() => null);
      const boosters = Object.entries(file?.data.booster ?? {}).map(([name, config]) => {
        const size = Object.values(config.boosters[0]?.contents ?? {}).reduce((a, b) => a + b, 0);
        return `${name}(${size})`;
      });
      const boxes = (file?.data.sealedProduct ?? [])
        .filter((p) => p.category === "booster_box")
        .map((p) => `${p.subtype ?? "?"}=${p.productSize ?? "?"}${p.identifiers?.tcgplayerProductId ? ` tcg:${p.identifiers.tcgplayerProductId}` : ""} [${packsInside(p)}] "${p.name}"`);
      const tcg = (s.tcgplayerGroupId && groupIds.has(s.tcgplayerGroupId)) || groupCodes.has(s.code.toUpperCase()) ? "tcgplayer" : "no-tcgplayer";
      lines.set(
        s.code,
        `${s.releaseDate} ${s.code.padEnd(5)} ${s.type.padEnd(16)} ${tcg.padEnd(12)} ${s.name}\n      boosters: ${boosters.join(", ") || "none"}\n      boxes: ${boxes.join(" | ") || "none"}`,
      );
      if (raw.has(s.code.toUpperCase())) {
        const sealed = (file?.data.sealedProduct ?? []).filter((p) => /booster/.test(p.category ?? ""));
        lines.set(s.code, `${lines.get(s.code)}\n      raw: ${JSON.stringify(sealed).slice(0, 6000)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  for (const s of sets) console.log(lines.get(s.code));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
