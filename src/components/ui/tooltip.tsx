import { Tooltip as T } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TooltipProvider = T.Provider;

export function Tooltip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          collisionPadding={12}
          className={cn(
            "z-50 max-w-72 bg-ink px-3 py-2 font-sans text-[13px] leading-snug text-canvas shadow-none",
            className,
          )}
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/** Small circled "i" that explains a term on hover or focus. */
export function InfoTip({ children, label = "More about this" }: { children: ReactNode; label?: string }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex size-4 translate-y-[-1px] items-center justify-center rounded-full border border-current align-middle font-serif text-[10px] leading-none italic opacity-60 hover:opacity-100"
      >
        i
      </button>
    </Tooltip>
  );
}
