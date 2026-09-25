import { Slider as SliderPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-6 w-full touch-none items-center select-none", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-px w-full grow bg-ink/40">
        <SliderPrimitive.Range className="absolute h-[3px] -translate-y-px bg-ink" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        className="block size-[18px] border-[3px] border-canvas bg-ink shadow-[0_0_0_1px_var(--ink)] transition-transform hover:scale-110 focus-visible:scale-110"
        aria-label={props["aria-label"]}
      />
    </SliderPrimitive.Root>
  );
}
