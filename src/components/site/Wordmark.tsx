import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("display inline-block leading-[0.86] whitespace-nowrap", className)}>
      <span className="font-[800]">Crack</span>
      <span className="mx-[0.14em] font-normal italic">or</span>
      <span className="font-[800]">Keep</span>
    </span>
  );
}
