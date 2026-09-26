import { useState } from "react";
import { InfoTip } from "@/components/ui/tooltip";
import { money, ratio } from "@/lib/format";
import type { SealedKind, SealedProduct } from "@/lib/types";
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

/**
 * Every sealed product for the set. Anything made of Play Boosters gets a price per
 * booster set against the value of an average pack, and can stand in as the box price.
 */
const GROUPS: { title: string; kinds: SealedKind[]; collapsed?: boolean }[] = [
  {
    title: "Play Boosters",
    kinds: ["Play Booster Display", "Play Booster Pack", "Sleeved Play Booster", "Play Booster Case", "Bundle", "Gift Bundle"],
  },
  { title: "Collector Boosters", kinds: ["Collector Booster Display", "Collector Booster Pack", "Collector Booster Case"] },
  { title: "Commander decks", kinds: ["Commander Deck"] },
  { title: "Everything else", kinds: ["Prerelease Pack", "Starter Kit", "Scene Box", "Jumpstart", "Case", "Other"], collapsed: true },
];

/**
 * Every sealed product for the set, grouped. Anything made of Play Boosters gets a price
 * per booster set against the value of an average pack, and can stand in as the box price.
 */
export function SealedSection({
  products,
  evPack,
  packsPerBox,
  boxPrice,
  onUseAsBox,
}: {
  products: SealedProduct[];
  evPack: number;
  packsPerBox: number;
  boxPrice: number | null;
  onUseAsBox: (price: number | null) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  // Unpriced listings (no sales, no offers yet) stay in the list, after the priced ones.
  const groups = GROUPS.map((g) => ({ ...g, items: products.filter((p) => g.kinds.includes(p.kind)) })).filter((g) => g.items.length);

  const row = (p: SealedProduct) => {
    const perPack = p.packs && p.market != null ? p.market / p.packs : null;
    const r = perPack != null && evPack > 0 ? perPack / evPack : null;
    // What this product implies for a full box, e.g. thirty loose packs.
    const asBox = perPack != null ? perPack * packsPerBox : null;
    const active = asBox != null && boxPrice != null && Math.abs(asBox - boxPrice) < 0.005;
    const title = p.kind === "Other" || p.kind === "Case" || p.kind === "Commander Deck" ? shortName(p.name) : p.kind;
    return (
      <tr key={p.productId} className="border-b border-hairline">
        <td className="py-2 pr-4">
          <a href={p.url} target="_blank" rel="noreferrer" className="group flex items-center gap-3">
            <Thumb src={p.image} alt="" />
            <span className="min-w-0">
              <span className="block font-semibold group-hover:underline group-hover:underline-offset-2">{title}</span>
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
          {p.packs != null && p.packs > 1 && <span className="block font-sans text-[11.5px] text-muted">{p.packs} boosters</span>}
        </td>
        <td className="num hidden py-2 pl-4 text-right md:table-cell">{r != null ? ratio(r) : <span className="text-muted">—</span>}</td>
        <td className="py-2 pl-4 text-right whitespace-nowrap">
          {asBox != null &&
            (active ? (
              <span className="kicker text-body">In use</span>
            ) : (
              <button
                type="button"
                onClick={() => onUseAsBox(p.kind === "Play Booster Display" ? null : Math.round(asBox * 100) / 100)}
                className="kicker text-ink underline decoration-1 underline-offset-4 hover:decoration-2"
                title={`Price the calculator as ${packsPerBox} boosters bought this way: ${money(asBox)}`}
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
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[14px] md:min-w-[760px]">
          <caption className="sr-only">Sealed products for this set with TCGplayer prices</caption>
          <thead>
            <tr className="border-b border-ink text-[12px] text-body">
              <th scope="col" className="py-2 pr-4 font-semibold">Product</th>
              <th scope="col" className="py-2 pl-4 text-right font-semibold">Market</th>
              <th scope="col" className="hidden py-2 pl-4 text-right font-semibold sm:table-cell">Lowest listing</th>
              <th scope="col" className="hidden py-2 pl-4 text-right font-semibold md:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  Per booster
                  <InfoTip>Market price divided by the Play Boosters inside. Bundles also hold lands, a promo and a spindown, which this ignores.</InfoTip>
                </span>
              </th>
              <th scope="col" className="hidden py-2 pl-4 text-right font-semibold md:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  Price ÷ value
                  <InfoTip>Price per booster divided by the value of an average pack at your settings. Under 1.00× the packs are worth more than they cost.</InfoTip>
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
                    <span className="kicker text-ink">{g.title}</span>
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
        listing on TCGplayer. &ldquo;Use as box&rdquo; prices the calculator as {packsPerBox} boosters bought that way.
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
