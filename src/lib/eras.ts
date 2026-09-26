/** Stretches of Magic's history for filtering the board and grouping the set menu. */
export interface Era {
  value: string;
  label: string;
  /** Inclusive range of release dates, as ISO date strings. */
  from: string;
  to: string;
}

export const ERAS: Era[] = [
  { value: "2024", label: "2024 on", from: "2024-01-01", to: "9999-12-31" },
  { value: "2020", label: "2020–2023", from: "2020-01-01", to: "2023-12-31" },
  { value: "2010", label: "2010s", from: "2010-01-01", to: "2019-12-31" },
  { value: "2000", label: "2000s", from: "2000-01-01", to: "2009-12-31" },
  { value: "1990", label: "1990s", from: "1990-01-01", to: "1999-12-31" },
];

export function eraOf(releasedAt: string): Era {
  return ERAS.find((e) => releasedAt >= e.from && releasedAt <= e.to) ?? ERAS[ERAS.length - 1];
}
