import { SetIcon } from "@/components/SetIcon";
import type { EvParams } from "@/lib/engine/ev";
import { date, isReleased, money } from "@/lib/format";
import type { Snapshot } from "@/lib/types";
import { cn } from "@/lib/utils";
import { settingsPhrase, VERDICT_TITLE, verdictFor, verdictLine } from "@/lib/verdict";

export function SetHeader({
  snapshot,
  boxPrice,
  evBox,
  params,
}: {
  snapshot: Snapshot;
  boxPrice: number | null;
  evBox: number;
  params: EvParams;
}) {
  const released = isReleased(snapshot.releasedAt);
  const r = boxPrice && evBox > 0 ? boxPrice / evBox : null;
  const verdict = verdictFor(r, snapshot.releasedAt);
  const cards = snapshot.product.cardsPerPack;

  return (
    <header className="grid gap-8 pt-10 pb-8 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
      <div>
        <p className="kicker text-body">
          {snapshot.product.name} · {snapshot.product.packsPerBox} packs{cards ? ` of ${cards} cards` : ""} ·{" "}
          {released ? "Released" : "Releases"} {date(snapshot.releasedAt)}
        </p>
        <h1 className="display mt-3 flex items-start gap-4 text-[clamp(52px,8.4vw,112px)] leading-[0.9]">
          <SetIcon src={snapshot.iconSvg} className="mt-[0.12em] h-[0.62em] w-auto shrink-0" />
          <span>{snapshot.name}</span>
        </h1>
        <p className="mt-6 max-w-2xl font-serif text-[19px] leading-[1.5] text-ink-soft sm:text-[21px]">
          {boxPrice ? (
            <>
              A box of {snapshot.product.packsPerBox} {snapshot.product.name}s costs about{" "}
              <strong className="font-semibold">{money(boxPrice)}</strong>.
              On today&rsquo;s prices, the cards inside are worth <strong className="font-semibold">{money(evBox)}</strong> on average,{" "}
              {settingsPhrase(params)}.
            </>
          ) : (
            <>
              On today&rsquo;s prices, the cards in a box are worth {money(evBox)} on average, {settingsPhrase(params)}. Enter a box
              price to compare.
            </>
          )}
        </p>
      </div>

      {verdict && boxPrice && (
        <aside
          className={cn(
            "flex flex-col justify-between self-start p-6 lg:mt-8",
            // A provisional call gets an outline instead of the solid block.
            verdict === "early" ? "border-2 border-ink" : "bg-ink text-canvas",
          )}
          aria-label="Verdict"
        >
          <p className="kicker opacity-70">The verdict</p>
          <p className="display mt-2 text-[44px] leading-none">{VERDICT_TITLE[verdict]}</p>
          <p className="mt-4 font-serif text-[16px] leading-snug opacity-90">{verdictLine(boxPrice, evBox, snapshot.releasedAt)}</p>
        </aside>
      )}
    </header>
  );
}
