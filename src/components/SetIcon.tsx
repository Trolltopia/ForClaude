import { cn } from "@/lib/utils";

export function SetIcon({ src, className }: { src: string | null; className?: string }) {
  if (!src) return null;
  return <img src={src} alt="" aria-hidden="true" className={cn("set-icon inline-block", className)} />;
}
