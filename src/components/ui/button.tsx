import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Square buttons only: the magazine never rounds an interactive corner.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-sans font-bold tracking-[0.02em] transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-ink text-canvas hover:bg-ink-soft",
        outline: "border border-ink bg-canvas text-ink hover:bg-ink hover:text-canvas",
        ghost: "text-ink hover:bg-canvas-soft",
        link: "text-ink underline decoration-1 underline-offset-4 hover:decoration-2",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-11 px-5 text-[15px]",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
