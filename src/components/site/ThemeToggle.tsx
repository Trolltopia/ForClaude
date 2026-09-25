import { useTheme } from "@/hooks/useTheme";

const LABEL = { system: "Auto", dark: "Dark", light: "Light" } as const;

export function ThemeToggle() {
  const { choice, cycle } = useTheme();
  return (
    <button
      type="button"
      onClick={cycle}
      className="kicker inline-flex items-center gap-1.5 hover:text-ink"
      aria-label={`Colour theme: ${LABEL[choice]}. Click to change.`}
    >
      <svg viewBox="0 0 16 16" className="size-3" aria-hidden="true">
        <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {choice === "system" && <path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor" />}
        {choice === "dark" && <circle cx="8" cy="8" r="6.5" fill="currentColor" />}
      </svg>
      {LABEL[choice]}
    </button>
  );
}
