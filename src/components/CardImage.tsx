import { useState } from "react";
import type { CardRecord } from "@/lib/types";

/** What a scan or a typeset stand-in needs: any card record, or a card in a deck list. */
type ImageCard = Pick<CardRecord, "name" | "image" | "rarity" | "set" | "cn"> & { typeLine?: string };
import { cn } from "@/lib/utils";
import { RarityPip } from "./RarityPip";

/** A card scan with rounded corners like the real thing, or a typeset proxy if the scan won't load. */
export function CardImage({
  card,
  foil = false,
  className,
  eager = false,
}: {
  card: ImageCard;
  foil?: boolean;
  className?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={cn("relative aspect-[488/680] overflow-hidden rounded-[4.6%/3.3%] bg-card-back", className)}>
      {card.image && !failed ? (
        <img
          src={card.image}
          alt={card.name}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Proxy card={card} />
      )}
      {foil && <div className="foil-sheen" aria-hidden="true" />}
    </div>
  );
}

function Proxy({ card }: { card: ImageCard }) {
  return (
    <div className="flex size-full flex-col border-[6px] border-ink p-[7%] text-ink" role="img" aria-label={card.name}>
      <div className="display text-[clamp(13px,1.6vw,19px)] leading-tight">{card.name}</div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink/30 pt-2">
        <span className="truncate font-sans text-[10px] tracking-wide text-body uppercase">{card.typeLine || "Card"}</span>
        <RarityPip rarity={card.rarity} />
      </div>
      <div className="mt-1 font-mono text-[9px] text-body uppercase">
        {card.set} · {card.cn}
      </div>
    </div>
  );
}
