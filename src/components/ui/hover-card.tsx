import { HoverCard as H } from "radix-ui";
import type { ReactNode } from "react";

export function HoverCard({
  trigger,
  children,
  side = "right",
}: {
  trigger: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <H.Root openDelay={120} closeDelay={60}>
      <H.Trigger asChild>{trigger}</H.Trigger>
      <H.Portal>
        <H.Content side={side} sideOffset={12} collisionPadding={16} className="z-50 outline-none">
          {children}
        </H.Content>
      </H.Portal>
    </H.Root>
  );
}
