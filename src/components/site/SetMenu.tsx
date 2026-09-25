import { DropdownMenu } from "radix-ui";
import { Link } from "wouter";
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
          className="z-50 max-h-[70vh] w-80 overflow-y-auto border border-ink bg-canvas py-1"
        >
          {CATALOG.map((s) => (
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
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
