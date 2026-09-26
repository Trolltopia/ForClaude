import { useState } from "react";
import { InfoTip } from "@/components/ui/tooltip";
import { boosterOfKind } from "@/lib/boosters";
import { money, ratio } from "@/lib/format";
import type { BoosterType, SealedKind, SealedProduct } from "@/lib/types";
import { cn } from "@/lib/utils";

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span aria-hidden="true" className="block size-10 shrink-0 bg-canvas-soft" />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="size-10 shrink-0 bg-canvas-soft object-contain"
    />
  );
}

const GROUPS: { title: string; kinds: SealedKind[]; collapsed?: boolean }[] = [
  { title: "Play Boosters", kinds: ["Play Booster Display", "Play Booster Pack", "Sleeved Play Booster", "Play Booster Case"] },
  { title: "Draft Boosters", kinds: ["Draft Booster Display", "Draft Booster Pack", "Draft Booster Case"] },
  { title: "Set Boosters", kinds: ["Set Booster Display", "Set Booster Pack", "Set Booster Case"] },
  { title: "Collector Boosters", kinds: ["Collector Booster Display", "Collector Booster Pack", "Collector Booster Case"] },
  { title: "Bundles", kinds: ["Bundle", "Gift Bundle"] },
  { title: "Commander decks", kinds: ["Commander Deck"] },
  { title: "Everything else", kinds: ["Prerelease Pack", "Starter Kit", "Scene Box", "Jumpstart", "Case", "Other"], collapsed: true },
];

/** A booster of this set the calculator can price, with its value at the current settings. */
export interface PricedBooster {
  type: BoosterType;
  /** The booster's name in its era, e.g. "Booster" for a Draft Booster before 2020. */
  name: string;
  packsPerBox: number;
  evPack: number;
  /** The TCGplayer listing behind the booster's market box price. */
  boxUrl: string | null;
}

/**
 * Every sealed product for the set, grouped. Anything with a known number of boosters
 * inside gets a price per booster, set against the value of an average booster of that
 * kind, and can stand in as the box price for that booster.
 */
export function SealedSection({
  products,
  boosters,
  current,
  boxPrice,
  onUseAsBox,
}: {
  products: SealedProduct[];
  boosters: PricedBooster[];
  /** The booster the calculator is showing. */
  current: BoosterType;
  boxPrice: number | null;
  /** Switch the calculator to a booster and price its box; null means the display's market price. */
  onUseAsBox: (booster: BoosterType, price: number | null) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Before Set Boosters existed, a Draft Booster was just a booster.
  const draftName = boosters.find((b) => b.type === "draft")?.name ?? "Draft Booster";
  // Unpriced listings (no sales, no offers yet) stay in the list, after the priced ones.
  const groups = GROUPS.map((g) => ({ ...g, items: products.filter((p) => g.kinds.includes(p.kind)) })).filter((g) => g.items.length);

  const row = (p: SealedProduct) => {
    // Snapshots from before sealed rows named their booster only counted Play Boosters.
    const type = p.booster ?? boosterOfKind(p.kind) ?? (p.packs ? "play" : null);
    const priced = boosters.find((b) => b.type === type);
    const perPack = p.packs && p.market != null ? p.market / p.packs : null;
    const r = perPack != null && priced && priced.evPack > 0 ? perPack / priced.evPack : null;
    // What this product implies for a full box of that booster, e.g. thirty loose packs.
    const asBox = perPack != null && priced ? perPack * priced.packsPerBox : null;
    const active = type === current && asBox != null && boxPrice != null && Math.abs(asBox - boxPrice) < 0.005;
    // The listing the market box price comes from: using it just drops any override.
    const isMarketBox = priced?.boxUrl != null && p.url === priced.boxUrl;
    const title = p.kind === "Other" || p.kind === "Case" || p.kind === "Commander Deck" ? shortName(p.name) : p.kind.replace("Draft Booster", draftName);
    return (
      <tr key={p.productId} className="border-b border-hairline">
        <td className="w-full max-w-0 py-2 pr-4">
          <a href={p.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3">
            <Thumb src={p.image} alt="" />
            <span className="min-w-0">
              <span className="block truncate font-semibold group-hover:underline group-hover:underline-offset-2">{title}</span>
              <span className="block truncate text-[12.5px] text-body">{p.name}</span>
            </span>
          </a>
        </td>
        <td className="num py-2 pl-4 text-right font-semibold">
          {p.market != null ? money(p.market) : <span className="font-sans text-[12.5px] font-normal text-muted">No sales yet</span>}
        </td>
        <td className="num hidden py-2 pl-4 text-right text-body sm:table-cell">{money(p.low)}</td>
        <td className="num hidden py-2 pl-4 text-right md:table-cell">
          {perPack != null ? money(perPack) : <span className="text-muted">—</span>}
          {p.packs != null && p.packs > 1 && (
            <span className="block font-sans text-[11.5px] text-muted">
              {p.packs} {priced && (p.kind === "Bundle" || p.kind === "Gift Bundle") ? `${priced.name}s` : "boosters"}
            </span>
          )}
        </td>
        <td className="num hidden py-2 pl-4 text-right md:table-cell">{r != null ? ratio(r) : <span className="text-muted">—</span>}</td>
        <td className="py-2 pl-4 text-right whitespace-nowrap">
          {asBox != null &&
            type &&
            (active ? (
              <span className="kicker text-body">In use</span>
            ) : (
              <button
                type="button"
                onClick={() => onUseAsBox(type, isMarketBox ? null : Math.round(asBox * 100) / 100)}
                className="kicker text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
                title={`Price the ${priced!.name} calculator as ${priced!.packsPerBox} boosters bought this way: ${money(asBox)}`}
              >
                Use as box
              </button>
            ))}
        </td>
      </tr>
    );
  };

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full border-collapse text-left text-[14px] md:min-w-[760px]">
          <caption className="sr-only">Sealed products for this set with TCGplayer prices</caption>
          <thead>
            <tr className="border-b border-ink text-[12px] text-body">
              <th scope="col" className="py-2 pr-4 font-semibold">Product</th>
              <th scope="col" className="py-2 pl-4 text-right font-semibold whitespace-nowrap">Market</th>
              <th scope="col" className="hidden py-2 pl-4 text-right font-semibold whitespace-nowrap sm:table-cell">Lowest listing</th>
              <th scope="col" className="hidden py-2 pl-4 text-right font-semibold whitespace-nowrap md:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  Per booster
                  <InfoTip>Market price divided by the boosters inside. Bundles also hold lands, a promo and a spindown, which this ignores.</InfoTip>
                </span>
              </th>
              <th scope="col" className="hidden py-2 pl-4 text-right font-semibold whitespace-nowrap md:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  Price ÷ value
                  <InfoTip>
                    Price per booster divided by the value of an average booster of the same kind at your settings. Under 1.00× the
                    packs are worth more than they cost.
                  </InfoTip>
                </span>
              </th>
              <th scope="col" className="py-2 pl-4 font-semibold">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          {groups.map((g) => {
            const expanded = !g.collapsed || open[g.title];
            const shown = expanded ? g.items : [];
            return (
              <tbody key={g.title}>
                <tr>
                  <th scope="colgroup" colSpan={6} className="pt-6 pb-2 text-left">
                    <span className="kicker text-ink">{g.title.replace("Draft Booster", draftName)}</span>
                    <span className="kicker ml-2 text-muted">{g.items.length}</span>
                    {g.collapsed && (
                      <button
                        type="button"
                        onClick={() => setOpen((o) => ({ ...o, [g.title]: !o[g.title] }))}
                        className="ml-4 text-[13px] font-semibold text-ink underline underline-offset-4"
                        aria-expanded={!!open[g.title]}
                      >
                        {open[g.title] ? "Hide" : "Show"}
                      </button>
                    )}
                  </th>
                </tr>
                {shown.map(row)}
              </tbody>
            );
          })}
        </table>
      </div>
      <p className="mt-4 text-[13px] text-body">
        TCGplayer market prices (recent sales) and lowest current listings. Commander decks come from the set&rsquo;s Commander
        listing on TCGplayer. &ldquo;Use as box&rdquo; prices a full box of that booster as boosters bought that way, and switches
        the calculator to it.
      </p>
    </div>
  );
}

/** Drop the set-name prefix TCGplayer puts on product names: "Commander: Duskmourn - Death Toll" → "Death Toll". */
function shortName(name: string): string {
  const parts = name.split(/\s[-–]\s/);
  return parts.length > 1 ? parts.slice(1).join(" – ") : name;
}

/** A compact line for sets without sealed data, e.g. browser-built snapshots. */
export function SealedUnavailable({ className }: { className?: string }) {
  return (
    <p className={cn("text-[14px] text-body", className)}>
      Sealed prices arrive with the daily snapshot. Run <code className="bg-canvas-soft px-1 font-mono text-[13px]">npm run data</code> locally to
      fetch them.
    </p>
  );
}
