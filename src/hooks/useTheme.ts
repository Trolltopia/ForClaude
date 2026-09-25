import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

function read(): ThemeChoice {
  try {
    const t = localStorage.getItem("ck-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    const root = document.documentElement;
    if (choice === "system") delete root.dataset.theme;
    else root.dataset.theme = choice;
    try {
      if (choice === "system") localStorage.removeItem("ck-theme");
      else localStorage.setItem("ck-theme", choice);
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
  }, [choice]);

  const cycle = useCallback(() => setChoice((c) => (c === "system" ? "dark" : c === "dark" ? "light" : "system")), []);
  return { choice, setChoice, cycle };
}
