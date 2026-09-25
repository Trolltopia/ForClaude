import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A numbered section with a mono rail on the left, like a magazine department. */
export function Section({
  id,
  number,
  rail,
  title,
  dek,
  children,
  className,
}: {
  id?: string;
  number: string;
  rail: string;
  title: ReactNode;
  dek?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("mt-20 scroll-mt-6 border-t-2 lg:scroll-mt-32 border-rule pt-5 sm:mt-24", className)} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="grid gap-x-10 gap-y-3 lg:grid-cols-[200px_minmax(0,1fr)]">
        <div className="kicker flex gap-3 text-ink lg:flex-col lg:gap-1">
          <span>{number}</span>
          <span className="text-body">{rail}</span>
        </div>
        <div className="max-w-3xl">
          <h2 id={id ? `${id}-title` : undefined} className="display text-[34px] leading-[1.02] sm:text-[44px]">
            {title}
          </h2>
          {dek && <div className="mt-3 font-serif text-[17px] leading-relaxed text-body">{dek}</div>}
        </div>
      </div>
      <div className="mt-8 lg:ml-[240px]">{children}</div>
    </section>
  );
}
