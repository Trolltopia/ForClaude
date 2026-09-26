import type {
  BoosterProduct,
  BoosterSummary,
  BoosterType,
  SealedKind,
  SealedProduct,
  SetSnapshot,
  SetSummary,
  Snapshot,
  SnapshotIndex,
} from "./types";

/** Display order: the main booster of each era first, Collector last. */
export const BOOSTER_TYPES: BoosterType[] = ["play", "draft", "set", "collector"];

export const BOOSTER_NAME: Record<BoosterType, string> = {
  play: "Play Booster",
  draft: "Draft Booster",
  set: "Set Booster",
  collector: "Collector Booster",
};

/** When Set Boosters arrived, the regular booster became the "Draft Booster". */
const DRAFT_BOOSTER_NAMED = "2020-09-25";

/** A booster's name in its own era: Draft Boosters were plain boosters before Zendikar Rising. */
export function boosterName(type: BoosterType, releasedAt: string): string {
  return type === "draft" && releasedAt < DRAFT_BOOSTER_NAMED ? "Booster" : BOOSTER_NAME[type];
}

/** "Play Booster" → "Play", for tight spots such as tabs on a phone. A plain booster stays "Booster". */
export function shortBoosterName(name: string): string {
  return name.replace(/ Booster$/, "") || name;
}

export function isBoosterType(s: string | null | undefined): s is BoosterType {
  return s != null && (BOOSTER_TYPES as string[]).includes(s);
}

export function byBoosterOrder<T extends { type: BoosterType }>(a: T, b: T): number {
  return BOOSTER_TYPES.indexOf(a.type) - BOOSTER_TYPES.indexOf(b.type);
}

/** Flatten one booster of a set into the shape the calculator works on. */
export function boosterView(set: SetSnapshot, booster: BoosterProduct): Snapshot {
  return {
    code: set.code,
    name: set.name,
    releasedAt: set.releasedAt,
    iconSvg: set.iconSvg,
    booster: booster.type,
    product: { name: booster.name, packsPerBox: booster.packsPerBox, cardsPerPack: booster.cardsPerPack },
    boxPrice: booster.boxPrice,
    sealed: set.sealed,
    model: booster.model,
    modelSource: booster.modelSource,
    cards: set.cards,
    generatedAt: set.generatedAt,
    sources: set.sources,
    notes: [...set.notes, ...booster.notes],
  };
}

const KIND_BOOSTER: Partial<Record<SealedKind, BoosterType>> = {
  "Play Booster Display": "play",
  "Play Booster Pack": "play",
  "Sleeved Play Booster": "play",
  "Play Booster Case": "play",
  "Draft Booster Display": "draft",
  "Draft Booster Pack": "draft",
  "Draft Booster Case": "draft",
  "Set Booster Display": "set",
  "Set Booster Pack": "set",
  "Set Booster Case": "set",
  "Collector Booster Display": "collector",
  "Collector Booster Pack": "collector",
  "Collector Booster Case": "collector",
};

/** The booster a sealed kind is made of, e.g. "Set Booster Pack" → set. Bundles depend on the era, so null. */
export function boosterOfKind(kind: SealedKind): BoosterType | null {
  return KIND_BOOSTER[kind] ?? null;
}

// Files written before sets carried several boosters had one Play Booster at the top level.
interface SnapshotV1 extends Omit<SetSnapshot, "version" | "boosters"> {
  version: 1;
  product: { name: string; packsPerBox: number; cardsPerPack: number | null };
  boxPrice: BoosterProduct["boxPrice"];
  model: BoosterProduct["model"];
  modelSource: BoosterProduct["modelSource"];
}

type SummaryV1 = Omit<SetSummary, "boosters" | "params"> &
  Omit<BoosterSummary, "type" | "name"> & { params?: SetSummary["params"] };

function v1Type(source: BoosterProduct["modelSource"]): BoosterType {
  return source.kind === "mtgjson" && (source.boosterName === "draft" || source.boosterName === "default") ? "draft" : "play";
}

function withBoosterField(sealed: SealedProduct[] | undefined): SealedProduct[] | undefined {
  return sealed?.map((p) => ({ ...p, booster: p.booster ?? boosterOfKind(p.kind) ?? (p.kind === "Bundle" && p.packs ? "play" : null) }));
}

/** Read a snapshot file of either format. */
export function upgradeSnapshot(raw: SetSnapshot | SnapshotV1): SetSnapshot {
  if (raw.version === 2) return raw;
  const { product, boxPrice, model, modelSource, version: _v, ...rest } = raw;
  const type = v1Type(modelSource);
  return {
    ...rest,
    version: 2,
    sealed: withBoosterField(rest.sealed),
    boosters: [
      {
        type,
        name: BOOSTER_NAME[type],
        packsPerBox: product.packsPerBox,
        cardsPerPack: product.cardsPerPack,
        boxPrice,
        model,
        modelSource,
        notes: [],
      },
    ],
  };
}

/** Read data/index.json of either format. */
export function upgradeIndex(raw: SnapshotIndex | { version: 1; generatedAt: string; sets: SummaryV1[] }): SnapshotIndex {
  if (raw.version === 2) return raw;
  return {
    version: 2,
    generatedAt: raw.generatedAt,
    sets: raw.sets.map((s) => ({
      code: s.code,
      name: s.name,
      releasedAt: s.releasedAt,
      iconSvg: s.iconSvg,
      params: s.params ?? { floor: 0, fees: 0 },
      boosters: [
        {
          type: "play",
          name: BOOSTER_NAME.play,
          packsPerBox: s.packsPerBox,
          boxPrice: s.boxPrice,
          evBox: s.evBox,
          evPack: s.evPack,
          ratio: s.ratio,
          pricedShare: s.pricedShare,
          topCard: s.topCard,
          modelSource: s.modelSource,
        },
      ],
    })),
  };
}
