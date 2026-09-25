import type { Rarity } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLOR: Record<Rarity, string> = {
  common: "bg-r-common",
  uncommon: "bg-r-uncommon",
  rare: "bg-r-rare",
  mythic: "bg-r-mythic",
  special: "bg-r-special",
  bonus: "bg-r-special",
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  mythic: "Mythic",
  special: "Special",
  bonus: "Bonus",
};

/** The expansion-symbol colour for a rarity, as a small diamond. The text label carries the meaning. */
export function RarityPip({ rarity, withLabel = false, className }: { rarity: Rarity; withLabel?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden="true" className={cn("inline-block size-[7px] rotate-45", COLOR[rarity])} />
      {withLabel ? <span>{RARITY_LABEL[rarity]}</span> : <span className="sr-only">{RARITY_LABEL[rarity]}</span>}
    </span>
  );
}
