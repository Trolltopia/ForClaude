import { InfoTip } from "@/components/ui/tooltip";
import type { BulkOutcome } from "@/lib/engine/simulate";
import { money, percent } from "@/lib/format";
import { cn } from "@/lib/utils";

function boxesLabel(n: number) {
  return n === 1 ? "1 box" : `${n} boxes`;
}

/** A simulated share: never quite "never" or "always". */
function chance(p: number) {
  if (p <= 0) return "under 0.1%";
  if (p >= 1) return "over 99.9%";
  return percent(p, p < 0.01 || p > 0.99 ? 1 : 0);
}

function Legend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-body">
      <li className="flex items-center gap-2">
        <span className="h-2.5 w-5 bg-deemph" aria-hidden="true" /> Nine runs in ten
      </li>
      <li className="flex items-center gap-2">
        <span className="h-2.5 w-5 bg-ink" aria-hidden="true" /> The middle half
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3.5 w-0.5 bg-keep" aria-hidden="true" /> Box price
      </li>
      <li className="flex items-center gap-2">
        <span className="h-3.5 w-0 border-l-2 border-dashed border-accent" aria-hidden="true" /> Expected value
      </li>
    </ul>
  );
}

/**
 * How a run of several boxes turns out, measured as the average box across the run. One
 * box swings a long way; a hundred settle close to the expected value.
 */
export function BulkSection({ bulk, boxPrice, evBox }: { bulk: BulkOutcome[]; boxPrice: number | null; evBox: number }) {
  // One scale for every row, so the ranges visibly narrow as the runs grow.
  const lo = Math.min(...bulk.map((b) => b.p5), boxPrice ?? Infinity, evBox);
  const hi = Math.max(...bulk.map((b) => b.p95), boxPrice ?? -Infinity, evBox);
  const pad = (hi - lo) * 0.04 || 1;
  const x = (v: number) => `${((v - (lo - pad)) / (hi - lo + 2 * pad)) * 100}%`;
  const hundred = bulk[bulk.length - 1];
  const one = bulk[0];

  return (
    <div>
      <Legend />
      <div className="relative mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-left text-[14px] md:min-w-[860px]">
          <caption className="sr-only">
            How runs of 1 to 100 boxes turn out, as the average value per box, with the chance of coming out ahead
          </caption>
          <thead>
            <tr className="border-b border-ink text-[12px] text-body">
              <th scope="col" className="py-2 pr-3 font-semibold sm:pr-4 sm:whitespace-nowrap">
                Boxes opened
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-semibold sm:pr-4 sm:whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  Comes out ahead
                  <InfoTip>Share of runs whose cards, together, were worth at least what the boxes cost.</InfoTip>
                </span>
              </th>
              <th scope="col" className="w-[34%] py-2 pr-3 font-semibold sm:pr-6 sm:whitespace-nowrap">
                Average value per box
              </th>
              <th scope="col" className="hidden py-2 pr-4 text-right font-semibold whitespace-nowrap md:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  Typical run
                  <InfoTip>The median run: half of runs do better per box, half do worse.</InfoTip>
                </span>
              </th>
              <th scope="col" className="hidden py-2 pr-4 text-right font-semibold whitespace-nowrap sm:table-cell">
                <span className="inline-flex items-center gap-1.5">
                  Bad run
                  <InfoTip>One run in twenty does this badly or worse, per box. Underneath: what that run loses in total at your box price.</InfoTip>
                </span>
              </th>
              <th scope="col" className="py-2 text-right font-semibold sm:whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                  Pay at most
                  <InfoTip>The box price at which nine runs in ten still come out ahead. Paying less than this is close to a sure thing.</InfoTip>
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {bulk.map((b) => {
              const loss = boxPrice != null ? (b.p5 - boxPrice) * b.boxes : null;
              return (
                <tr key={b.boxes} className="border-b border-hairline">
                  <th scope="row" className="py-3 pr-3 text-left font-sans text-[15px] font-bold whitespace-nowrap sm:pr-4">
                    {boxesLabel(b.boxes)}
                  </th>
                  <td className="num py-3 pr-3 text-right text-[15px] font-semibold whitespace-nowrap sm:pr-4">
                    {b.beatPrice != null ? chance(b.beatPrice) : "—"}
                  </td>
                  <td className="py-3 pr-3 sm:pr-6">
                    <div
                      className="relative h-6"
                      role="img"
                      aria-label={`${boxesLabel(b.boxes)}: nine runs in ten average ${money(b.p5)} to ${money(b.p95)} a box, the middle half ${money(b.p25)} to ${money(b.p75)}`}
                      title={`Nine runs in ten: ${money(b.p5)} to ${money(b.p95)} a box. Middle half: ${money(b.p25)} to ${money(b.p75)}.`}
                    >
                      <span className="absolute top-2 h-2 bg-deemph" style={{ left: x(b.p5), width: `calc(${x(b.p95)} - ${x(b.p5)})` }} />
                      <span className="absolute top-2 h-2 bg-ink" style={{ left: x(b.p25), width: `calc(${x(b.p75)} - ${x(b.p25)})` }} />
                      <span className="absolute top-0 h-6 border-l-2 border-dashed border-accent" style={{ left: x(evBox) }} />
                      {boxPrice != null && <span className="absolute top-0 h-6 w-0.5 bg-keep" style={{ left: x(boxPrice) }} />}
                    </div>
                  </td>
                  <td className="num hidden py-3 pr-4 text-right md:table-cell">{money(b.p50)}</td>
                  <td className="num hidden py-3 pr-4 text-right sm:table-cell">
                    {money(b.p5)}
                    {loss != null && (
                      <span className={cn("block font-sans text-[11.5px]", loss < 0 ? "text-bad" : "text-body")}>
                        {loss < 0 ? `${money(loss, { cents: false })} in total` : "still ahead"}
                      </span>
                    )}
                  </td>
                  <td className="num py-3 text-right font-semibold">{money(b.p10)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-3xl text-[13px] text-body">
        {boxPrice != null && one?.beatPrice != null && hundred?.beatPrice != null ? (
          <>
            At {money(boxPrice)} a box, a single box comes out ahead {chance(one.beatPrice)} of the time and a run of{" "}
            {hundred.boxes} boxes {chance(hundred.beatPrice)}. Breaking even on average means paying no more than the expected
            value, {money(evBox)}; to come out ahead nine times in ten, pay no more than {money(one.p10)} for a single box, or{" "}
            {money(hundred.p10)} a box for {hundred.boxes}.{" "}
          </>
        ) : null}
        Each run is drawn from the ten thousand simulated boxes, whose packs are opened independently. Real packs come off shared
        print sheets, which can make a box a little more even or a little streakier than that, and selling a hundred boxes&rsquo;
        worth of the same cards can itself push their prices down.
      </p>
    </div>
  );
}
