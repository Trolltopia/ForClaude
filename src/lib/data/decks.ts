import { fixedId, priceInFinish } from "../fixed";
import type { BoxPrice, CardFinish, FixedCard, FixedKind, FixedProduct } from "../types";
import type { MtgjsonDeck, MtgjsonDeckRef, MtgjsonSetFile } from "./mtgjson";
import { normaliseCard, type ScryfallClient } from "./scryfall";
import type { TcgPrice, TcgProduct } from "./tcgcsv";

/** A row of MTGJSON's DeckList.json. */
export interface DeckListEntry {
  code: string;
  fileName: string;
  name: string;
  releaseDate: string;
  type: string;
}

/** Which of our products a deck list is: Commander precons (Secret Lair ones included) and Secret Lair drops. */
export function fixedKindOf(type: string): FixedKind | null {
  if (type === "Commander Deck") return "commander";
  if (type === "Secret Lair Drop") return "secret-lair";
  return null;
}

/**
 * The cards a sealed deck or drop holds: its commanders, main deck and extras. Not the
 * oversized display commander, which repeats the commander, and not tokens.
 */
export function deckContents(deck: MtgjsonDeck): { uuid: string; count: number; finish: CardFinish; commander: boolean }[] {
  const finish = (r: MtgjsonDeckRef): CardFinish => (r.isEtched ? "etched" : r.isFoil ? "foil" : "nonfoil");
  return [
    ...(deck.commander ?? []).map((r) => ({ uuid: r.uuid, count: r.count, finish: finish(r), commander: true })),
    ...[...(deck.mainBoard ?? []), ...(deck.sideBoard ?? [])].map((r) => ({ uuid: r.uuid, count: r.count, finish: finish(r), commander: false })),
  ];
}

export interface FixedDeps {
  client: ScryfallClient;
  /** An MTGJSON set file by code, or null. */
  mtgjson: (code: string) => Promise<MtgjsonSetFile | null>;
  /** A TCGplayer group's products and prices. */
  tcgGroup: (groupId: number) => Promise<{ products: TcgProduct[]; prices: TcgPrice[] }>;
  log?: (line: string) => void;
}

interface Pending {
  entry: DeckListEntry;
  kind: FixedKind;
  deck: MtgjsonDeck;
  setName: string;
  price: BoxPrice;
  tcgplayerId: number | null;
  contents: ReturnType<typeof deckContents>;
}

/**
 * Price every deck list in `entries`: cards through Scryfall in the finish the product
 * holds them, and the sealed product through its TCGplayer listing.
 */
export async function buildFixedProducts(entries: DeckListEntry[], deps: FixedDeps): Promise<FixedProduct[]> {
  const log = deps.log ?? (() => {});
  const byCode = new Map<string, DeckListEntry[]>();
  for (const e of entries) byCode.set(e.code.toUpperCase(), [...(byCode.get(e.code.toUpperCase()) ?? []), e]);

  const uuidToScryfall = new Map<string, string>();
  // Set files whose cards are already in the map; many lists share the same source sets.
  const indexed = new Set<string>();
  const pending: Pending[] = [];
  const asOf = new Date().toISOString();

  for (const [code, list] of byCode) {
    const file = await deps.mtgjson(code);
    if (!file) {
      log(`  ${code}: no MTGJSON set file; skipped ${list.length} decks`);
      continue;
    }
    const indexCards = (setCode: string, f: MtgjsonSetFile) => {
      indexed.add(setCode);
      for (const c of [...f.data.cards, ...(f.data.tokens ?? [])]) if (c.identifiers?.scryfallId) uuidToScryfall.set(c.uuid, c.identifiers.scryfallId);
    };
    if (!indexed.has(code)) indexCards(code, file);

    let group: Awaited<ReturnType<FixedDeps["tcgGroup"]>> | null = null;
    if (file.data.tcgplayerGroupId) {
      try {
        group = await deps.tcgGroup(file.data.tcgplayerGroupId);
      } catch {
        group = null;
      }
    }
    const priceById = new Map((group?.prices ?? []).filter((p) => !p.subTypeName || p.subTypeName === "Normal").map((p) => [p.productId, p]));
    const productById = new Map((group?.products ?? []).map((p) => [p.productId, p]));

    for (const entry of list) {
      const kind = fixedKindOf(entry.type)!;
      const deck = file.data.decks?.find((d) => d.name === entry.name && d.type === entry.type);
      if (!deck) {
        log(`  ${code}: no list for "${entry.name}"`);
        continue;
      }
      // Cards printed in other sets (reprints, promos) need those sets' ids too.
      for (const other of (deck.sourceSetCodes ?? []).map((c) => c.toUpperCase())) {
        if (indexed.has(other)) continue;
        const extra = await deps.mtgjson(other);
        if (extra) indexCards(other, extra);
        else indexed.add(other);
      }
      const sealed = (file.data.sealedProduct ?? []).find((p) => deck.sealedProductUuids?.includes(p.uuid));
      const tcgplayerId = Number(sealed?.identifiers?.tcgplayerProductId) || null;
      const row = tcgplayerId ? priceById.get(tcgplayerId) : undefined;
      const product = tcgplayerId ? productById.get(tcgplayerId) : undefined;
      const usd = row?.marketPrice ?? row?.midPrice ?? row?.lowPrice ?? null;
      const price: BoxPrice =
        usd != null
          ? {
              usd,
              source: "tcgplayer",
              productName: product?.name ?? sealed?.name,
              productUrl: product?.url ?? `https://www.tcgplayer.com/product/${tcgplayerId}`,
              asOf,
            }
          : { usd: null, source: "estimate" };
      pending.push({ entry, kind, deck, setName: file.data.name, price, tcgplayerId, contents: deckContents(deck) });
    }
  }

  // One Scryfall pass for every card in every list.
  const ids = [...new Set(pending.flatMap((p) => p.contents.map((c) => uuidToScryfall.get(c.uuid)).filter((id): id is string => !!id)))];
  const cards = new Map((ids.length ? await deps.client.collection(ids) : []).map((c) => [c.id, normaliseCard(c)]));

  const used = new Set<string>();
  return pending.map(({ entry, kind, deck, setName, price, tcgplayerId, contents }) => {
    let id = fixedId(entry.name, entry.code);
    for (let n = 2; used.has(id); n++) id = `${fixedId(entry.name, entry.code)}-${n}`;
    used.add(id);
    const notes: string[] = [];
    const list: FixedCard[] = [];
    let missing = 0;
    for (const c of contents) {
      const card = cards.get(uuidToScryfall.get(c.uuid) ?? "");
      if (!card) {
        missing += c.count;
        continue;
      }
      list.push({
        id: card.id,
        name: card.name,
        set: card.set,
        cn: card.cn,
        rarity: card.rarity,
        treatmentLabel: card.treatmentLabel,
        finish: c.finish,
        count: c.count,
        price: priceInFinish(card, c.finish),
        image: card.image,
        scryfallUri: card.scryfallUri,
        ...(c.commander ? { commander: true } : {}),
      });
    }
    if (missing) notes.push(`${missing} card${missing === 1 ? "" : "s"} in the list could not be matched to Scryfall and are left out.`);
    if (price.usd == null) notes.push("TCGplayer has no market price for the sealed product yet.");
    return {
      version: 1 as const,
      id,
      kind,
      name: entry.name,
      setCode: entry.code.toUpperCase(),
      setName,
      releasedAt: deck.releaseDate ?? entry.releaseDate,
      price,
      tcgplayerId,
      cards: list,
      generatedAt: new Date().toISOString(),
      notes,
    };
  });
}
