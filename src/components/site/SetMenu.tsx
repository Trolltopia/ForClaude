import { DropdownMenu } from "radix-ui";
import { Link } from "wouter";
import { ERAS, eraOf } from "@/lib/eras";
import { monthYear } from "@/lib/format";
import { CATALOG } from "@/sets/catalog";

export function SetMenu() {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger className="group inline-flex items-center gap-1 font-sans text-[14px] font-bold tracking-[0.02em] outline-none">
        Sets
        <svg viewBox="0 0 10 6" className="h-1.5 w-2.5 transition-transform group-data-[state=open]:rotate-180" aria-hidden="true">
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={10}
          className="z-50 max-h-[70vh] w-[min(26rem,calc(100vw-2rem))] overflow-y-auto border border-ink bg-canvas pb-1"
        >
          {ERAS.map((era) => {
            const sets = CATALOG.filter((s) => eraOf(s.releasedAt) === era);
            return (
              <DropdownMenu.Group key={era.value}>
                <DropdownMenu.Label className="kicker sticky top-0 border-b border-hairline bg-canvas px-4 pt-3 pb-1.5 text-body normal-case">
                  {era.label} <span className="text-muted">· {sets.length}</span>
                </DropdownMenu.Label>
                {sets.map((s) => (
                  <DropdownMenu.Item key={s.code} asChild>
                    <Link
                      href={`/sets/${s.code}`}
                      className="flex items-baseline gap-3 px-4 py-2 text-ink outline-none data-[highlighted]:bg-ink data-[highlighted]:text-canvas"
                    >
                      <span className="kicker w-9 shrink-0">{s.code}</span>
                      <span className="flex-1 truncate font-sans text-[14px] font-semibold">{s.name}</span>
                      <span className="font-mono text-[11px] opacity-60">{monthYear(s.releasedAt)}</span>
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Group>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
