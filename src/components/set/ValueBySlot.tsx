import { ShareBar } from "@/components/charts/Bars";
import type { EvResult } from "@/lib/engine/ev";
import { money, percent } from "@/lib/format";

export function ValueBySlot({ ev }: { ev: EvResult }) {
  const rows = ev.sheets.filter((s) => s.perPack > 0);
  const max = Math.max(...rows.map((r) => r.share), 0);
  const cardsPerPack = rows.reduce((s, r) => s + r.perPack, 0);

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left sm:min-w-[640px]">
        <caption className="sr-only">Expected value of a box by booster slot</caption>
        <thead>
          <tr className="border-b border-ink text-[12px] text-body">
            <th scope="col" className="py-2 pr-4 font-semibold">Slot</th>
            <th scope="col" className="hidden py-2 pr-4 text-right font-semibold sm:table-cell">Cards a pack</th>
            <th scope="col" className="hidden py-2 pr-4 text-right font-semibold sm:table-cell">Average card</th>
            <th scope="col" className="py-2 pr-4 text-right font-semibold sm:pr-6">Per box</th>
            <th scope="col" className="w-[34%] py-2 font-semibold sm:w-[38%]">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.key} className="border-b border-hairline">
              <th scope="row" className="py-3 pr-4 text-[15px] font-semibold">
                {s.label}
                {s.foil === "foil" && !/foil/i.test(s.label) && <span className="ml-2 font-normal text-body">foil</span>}
              </th>
              <td className="num hidden py-3 pr-4 text-right text-[15px] sm:table-cell">{s.perPack.toFixed(s.perPack % 1 ? 2 : 0)}</td>
              <td className="num hidden py-3 pr-4 text-right text-[15px] sm:table-cell">{money(s.avgValue)}</td>
              <td className="num py-3 pr-4 text-right text-[15px] font-semibold sm:pr-6">{money(s.evBox)}</td>
              <td className="py-3">
                <div className="flex items-center gap-3">
                  <ShareBar value={s.share} max={max} className="flex-1" />
                  <span className="num w-10 shrink-0 text-right text-[13px] text-body">{percent(s.share)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="text-[15px]">
            <th scope="row" className="py-3 pr-4 font-bold">
              Box
            </th>
            <td className="num hidden py-3 pr-4 text-right sm:table-cell">{cardsPerPack.toFixed(0)}</td>
            <td className="num hidden py-3 pr-4 text-right text-body sm:table-cell">—</td>
            <td className="num py-3 pr-4 text-right font-bold sm:pr-6">{money(ev.evBox)}</td>
            <td className="py-3 text-[13px] text-body">{ev.packsPerBox} packs</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
