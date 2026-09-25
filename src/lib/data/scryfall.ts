import type { CardRecord, Finish, Rarity, Treatment } from "../types";

// Only the Scryfall fields we read. See https://scryfall.com/docs/api/cards
export interface ScryfallCard {
  object: "card";
  id: string;
  name: string;
  set: string;
  collector_number: string;
  rarity: string;
  released_at?: string;
  border_color?: string;
  frame_effects?: string[];
  promo_types?: string[];
  full_art?: boolean;
  finishes?: string[];
  type_line?: string;
  colors?: string[];
  color_identity?: string[];
  image_uris?: { small?: string; normal?: string; large?: string; png?: string; art_crop?: string };
  card_faces?: { name?: string; type_line?: string; colors?: string[]; image_uris?: ScryfallCard["image_uris"] }[];
  scryfall_uri?: string;
  tcgplayer_id?: number;
  booster?: boolean;
  prices?: Partial<Record<"usd" | "usd_foil" | "usd_etched" | "eur" | "eur_foil" | "tix", string | null>>;
}

export interface ScryfallSet {
  object: "set";
  code: string;
  name: string;
  released_at?: string;
  icon_svg_uri?: string;
  card_count?: number;
  printed_size?: number;
  set_type?: string;
}

export interface ScryfallList<T> {
  object: "list";
  data: T[];
  has_more?: boolean;
  next_page?: string;
  not_found?: unknown[];
  total_cards?: number;
}

export const SCRYFALL_API = "https://api.scryfall.com";

const FOIL_NAMES: Record<string, string> = {
  galaxyfoil: "Galaxy foil",
  surgefoil: "Surge foil",
  fracturefoil: "Fracture foil",
  texturedfoil: "Textured foil",
  halofoil: "Halo foil",
  raisedfoil: "Raised foil",
  confettifoil: "Confetti foil",
  rainbowfoil: "Rainbow foil",
  doublerainbow: "Double rainbow foil",
  gildedfoil: "Gilded foil",
  neonink: "Neon ink",
  oilslick: "Oil slick foil",
  stepandcompleat: "Step-and-compleat foil",
  manafoil: "Mana foil",
  firstplacefoil: "First-place foil",
  dragonscalefoil: "Dragonscale foil",
  singularityfoil: "Singularity foil",
  cosmicfoil: "Cosmic foil",
  chocobotrackfoil: "Chocobo track foil",
};

const RARITIES: Rarity[] = ["common", "uncommon", "rare", "mythic", "special", "bonus"];

function num(v: string | null | undefined): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function treatmentOf(card: ScryfallCard): { treatment: Treatment; label: string } {
  const frame = card.frame_effects ?? [];
  const promos = card.promo_types ?? [];
  const typeLine = card.type_line ?? card.card_faces?.[0]?.type_line ?? "";
  if (card.set === "spg") return { treatment: "guest", label: "Special Guest" };
  if (promos.includes("serialized")) return { treatment: "serialized", label: "Serialized" };
  if (frame.includes("showcase")) return { treatment: "showcase", label: "Showcase" };
  if (frame.includes("extendedart")) return { treatment: "extended", label: "Extended art" };
  if (card.full_art && /\bBasic\b/.test(typeLine)) return { treatment: "fullart", label: "Full-art land" };
  if (card.border_color === "borderless") return { treatment: "borderless", label: "Borderless" };
  if (card.full_art) return { treatment: "other", label: "Full art" };
  return { treatment: "normal", label: "Regular" };
}

export function normaliseCard(card: ScryfallCard): CardRecord {
  const face = card.card_faces?.[0];
  const typeLine = card.type_line ?? face?.type_line ?? "";
  const images = card.image_uris ?? face?.image_uris;
  const { treatment, label } = treatmentOf(card);
  const foilPromo = (card.promo_types ?? []).find((p) => p in FOIL_NAMES);
  const rarity = (RARITIES as string[]).includes(card.rarity) ? (card.rarity as Rarity) : "special";
  const finishes = (card.finishes ?? ["nonfoil", "foil"]).filter((f): f is Finish =>
    f === "nonfoil" || f === "foil" || f === "etched",
  );
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    cn: card.collector_number,
    rarity,
    treatment,
    treatmentLabel: label,
    ...(foilPromo ? { foilLabel: FOIL_NAMES[foilPromo] } : {}),
    finishes,
    typeLine,
    colors: card.colors ?? face?.colors ?? card.color_identity ?? [],
    isBasicLand: /^Basic\b.*\bLand\b/.test(typeLine),
    image: images?.normal ?? null,
    scryfallUri: card.scryfall_uri ?? null,
    tcgplayerId: card.tcgplayer_id ?? null,
    prices: {
      usd: num(card.prices?.usd),
      usdFoil: num(card.prices?.usd_foil),
      usdEtched: num(card.prices?.usd_etched),
      eur: num(card.prices?.eur),
      eurFoil: num(card.prices?.eur_foil),
    },
  };
}

/** Numeric part of a collector number, for range checks ("123a" → 123, "★" → NaN). */
export function collectorNumber(cn: string): number {
  const m = /^(\d+)/.exec(cn);
  return m ? Number(m[1]) : Number.NaN;
}

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface ScryfallClientOptions {
  fetch?: FetchLike;
  /** Pause between requests. Scryfall asks for 50–100ms; search endpoints want ~500ms. */
  delayMs?: number;
  headers?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createScryfallClient(options: ScryfallClientOptions = {}) {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const delay = options.delayMs ?? 120;
  const headers = { Accept: "application/json", ...options.headers };
  let last = 0;

  async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const wait = last + delay - Date.now();
    if (wait > 0) await sleep(wait);
    for (let attempt = 0; ; attempt++) {
      last = Date.now();
      const res = await doFetch(url, { ...init, headers: { ...headers, ...(init?.headers as Record<string, string>) } });
      if (res.status === 429 && attempt < 3) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (res.status === 404) throw new ScryfallNotFound(url);
      if (!res.ok) throw new Error(`Scryfall ${res.status} for ${url}`);
      return (await res.json()) as T;
    }
  }

  return {
    set(code: string) {
      return request<ScryfallSet>(`${SCRYFALL_API}/sets/${encodeURIComponent(code)}`);
    },

    /** Every printing matching a search, following pagination. Empty results return []. */
    async search(query: string): Promise<ScryfallCard[]> {
      const params = new URLSearchParams({
        q: query,
        unique: "prints",
        include_extras: "true",
        include_variations: "true",
        order: "set",
      });
      let url: string | undefined = `${SCRYFALL_API}/cards/search?${params}`;
      const out: ScryfallCard[] = [];
      while (url) {
        let page: ScryfallList<ScryfallCard>;
        try {
          page = await request<ScryfallList<ScryfallCard>>(url);
        } catch (err) {
          if (err instanceof ScryfallNotFound && out.length === 0) return [];
          throw err;
        }
        out.push(...page.data);
        url = page.has_more ? page.next_page : undefined;
      }
      return out;
    },

    /** Look up cards by Scryfall id, 75 per request. */
    async collection(ids: string[]): Promise<ScryfallCard[]> {
      const out: ScryfallCard[] = [];
      for (let i = 0; i < ids.length; i += 75) {
        const chunk = ids.slice(i, i + 75);
        const page = await request<ScryfallList<ScryfallCard>>(`${SCRYFALL_API}/cards/collection`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifiers: chunk.map((id) => ({ id })) }),
        });
        out.push(...page.data);
      }
      return out;
    },
  };
}

export class ScryfallNotFound extends Error {
  constructor(url: string) {
    super(`Scryfall 404 for ${url}`);
    this.name = "ScryfallNotFound";
  }
}

export type ScryfallClient = ReturnType<typeof createScryfallClient>;
