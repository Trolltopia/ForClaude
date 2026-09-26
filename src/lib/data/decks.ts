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

interface CardIds {
  scryfallId: string;
  tcg: number | null;
  tcgEtched: number | null;
  /** The separate TCGplayer product for a special foil (rainbow, surge, ripple…). */
  tcgFoil: number | null;
  /** The TCGplayer group of the set file the card came from. */
  group: number | null;
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

  // Each card's Scryfall id, and where TCGplayer lists it in case Scryfall has no price.
  const uuidInfo = new Map<string, CardIds>();
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
      for (const c of [...f.data.cards, ...(f.data.tokens ?? [])]) {
        if (!c.identifiers?.scryfallId) continue;
        uuidInfo.set(c.uuid, {
          scryfallId: c.identifiers.scryfallId,
          tcg: Number(c.identifiers.tcgplayerProductId) || null,
          tcgEtched: Number(c.identifiers.tcgplayerEtchedProductId) || null,
          tcgFoil: Number(c.identifiers.tcgplayerAlternativeFoilProductId) || null,
          group: f.data.tcgplayerGroupId ?? null,
        });
      }
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
  const ids = [...new Set(pending.flatMap((p) => p.contents.map((c) => uuidInfo.get(c.uuid)?.scryfallId).filter((id): id is string => !!id)))];
  const cards = new Map((ids.length ? await deps.client.collection(ids) : []).map((c) => [c.id, normaliseCard(c)]));

  // Scryfall often has a card's regular price but not the foil one a product holds (Secret
  // Lair foil editions, Collector's Edition decks). TCGplayer's own price list, the same one
  // the sealed prices come from, usually has it.
  const groupPrices = new Map<number, Promise<Map<number, { normal: number | null; foil: number | null }>>>();
  const pricesOf = (group: number) => {
    if (!groupPrices.has(group)) {
      groupPrices.set(
        group,
        deps
          .tcgGroup(group)
          .then(({ prices }) => {
            const out = new Map<number, { normal: number | null; foil: number | null }>();
            for (const p of prices) {
              const row = out.get(p.productId) ?? { normal: null, foil: null };
              // Sales only: before release the middle listing is a preorder asking price.
              const usd = p.marketPrice ?? null;
              if (p.subTypeName === "Foil") row.foil = usd;
              else if (!p.subTypeName || p.subTypeName === "Normal") row.normal = usd;
              out.set(p.productId, row);
            }
            return out;
          })
          .catch(() => new Map()),
      );
    }
    return groupPrices.get(group)!;
  };
  // A foil can sit on the card's own product or, for special foils, on a product of its own;
  // an etched foil has its own product too.
  const tcgPriceOf = async (info: CardIds, finish: CardFinish, onlyFoil: boolean): Promise<number | null> => {
    if (!info.group) return null;
    const prices = await pricesOf(info.group);
    const row = (id: number | null) => (id ? prices.get(id) : undefined);
    if (finish === "nonfoil") return row(info.tcg)?.normal ?? (onlyFoil ? (row(info.tcg)?.foil ?? row(info.tcgFoil)?.foil) : null) ?? null;
    if (finish === "etched") return row(info.tcgEtched)?.foil ?? row(info.tcg)?.foil ?? null;
    return row(info.tcg)?.foil ?? row(info.tcgFoil)?.foil ?? null;
  };
  const tcgPrices = new Map<string, number | null>();
  for (const { contents } of pending) {
    for (const c of contents) {
      const info = uuidInfo.get(c.uuid);
      const card = cards.get(info?.scryfallId ?? "");
      const key = `${c.uuid}:${c.finish}`;
      if (!info || !card || priceInFinish(card, c.finish) != null || tcgPrices.has(key)) continue;
      tcgPrices.set(key, await tcgPriceOf(info, c.finish, !card.finishes.includes("nonfoil")));
    }
  }

  const used = new Set<string>();
  const worst: { name: string; code: string; share: number; uuids: [string, CardFinish][] }[] = [];
  const products = pending.map(({ entry, kind, deck, setName, price, tcgplayerId, contents }) => {
    let id = fixedId(entry.name, entry.code);
    for (let n = 2; used.has(id); n++) id = `${fixedId(entry.name, entry.code)}-${n}`;
    used.add(id);
    const notes: string[] = [];
    const list: FixedCard[] = [];
    let missing = 0;
    let fromTcg = 0;
    for (const c of contents) {
      const card = cards.get(uuidInfo.get(c.uuid)?.scryfallId ?? "");
      if (!card) {
        missing += c.count;
        continue;
      }
      let price = priceInFinish(card, c.finish);
      if (price == null) {
        price = tcgPrices.get(`${c.uuid}:${c.finish}`) ?? null;
        if (price != null) fromTcg += c.count;
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
        price,
        image: card.image,
        scryfallUri: card.scryfallUri,
        ...(c.commander ? { commander: true } : {}),
      });
    }
    const copies = list.reduce((s, c) => s + c.count, 0);
    const unpricedCopies = list.filter((c) => c.price == null).reduce((s, c) => s + c.count, 0);
    if (copies && unpricedCopies / copies > 0.5) {
      worst.push({ name: entry.name, code: entry.code, share: unpricedCopies / copies, uuids: contents.filter((c) => list.some((l) => l.price == null && l.id === uuidInfo.get(c.uuid)?.scryfallId)).map((c) => [c.uuid, c.finish]) });
    }
    if (missing) notes.push(`${missing} card${missing === 1 ? "" : "s"} in the list could not be matched to Scryfall and are left out.`);
    if (fromTcg) notes.push(`${fromTcg} card price${fromTcg === 1 ? " comes" : "s come"} straight from TCGplayer: Scryfall had none for the finish in this product.`);
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

  // Say why the least-priced products lack prices, so a run's log can be read without guessing.
  if (deps.log) {
    for (const w of worst.sort((a, b) => b.share - a.share).slice(0, 12)) {
      for (const [uuid, finish] of w.uuids.slice(0, 2)) {
        const info = uuidInfo.get(uuid)!;
        const card = cards.get(info.scryfallId)!;
        const rows = info.group ? await pricesOf(info.group) : new Map();
        const show = (id: number | null) => (id ? `${id} ${JSON.stringify(rows.get(id) ?? "no row")}` : "none");
        log(
          `  unpriced (${Math.round(w.share * 100)}% of ${w.name}, ${w.code}): ${card.name} ${card.set} ${card.cn} as ${finish}; Scryfall ${card.finishes.join("/")} usd ${card.prices.usd} foil ${card.prices.usdFoil} etched ${card.prices.usdEtched}; group ${info.group}; tcg ${show(info.tcg)}; foil product ${show(info.tcgFoil)}; etched product ${show(info.tcgEtched)}`,
        );
      }
    }
  }
  return products;
}
