import { ToggleGroup } from "radix-ui";
import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
}

/** A row of square toggle buttons that behaves like a radio group. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex border border-ink", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="num h-8 min-w-11 border-l border-ink px-2.5 font-sans text-[13px] font-semibold text-ink transition-colors first:border-l-0 hover:bg-canvas-soft data-[state=on]:bg-ink data-[state=on]:text-canvas"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
