const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** $1,284.50 — cents shown under $1,000, whole dollars above. */
export function money(n: number | null | undefined, opts: { cents?: boolean } = {}): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const cents = opts.cents ?? Math.abs(n) < 1000;
  return (cents ? usd2 : usd0).format(n);
}

/** Signed money for deltas, using a true minus sign. */
export function signedMoney(n: number): string {
  const s = money(Math.abs(n));
  return n < 0 ? `−${s}` : `+${s}`;
}

export function percent(n: number | null | undefined, digits = 0): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = n * 100;
  if (v > 0 && v < 1 && digits === 0) return v < 0.1 ? "<0.1%" : `${v.toFixed(1)}%`;
  return `${v.toFixed(digits)}%`;
}

/** A return as a signed percentage: "+35%", "−12%" (a true minus sign), or "0%". */
export function signedPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const v = Math.round(n * 100);
  if (v === 0) return "0%";
  return `${v > 0 ? "+" : "−"}${Math.abs(v)}%`;
}

/** A share of simulated boxes: never quite "never" or "always", since it's an estimate. */
export function chance(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  // Anything that would round to 0.0% or 100.0% is said as a bound instead.
  if (p < 0.0005) return "under 0.1%";
  if (p > 0.9995) return "over 99.9%";
  return percent(p, p < 0.01 || p > 0.99 ? 1 : 0);
}

export function count(n: number): string {
  return int.format(n);
}

/** "1 in 1,440" from an expected count per pack. */
export function oneIn(perPack: number, unit = "packs"): string {
  if (perPack <= 0) return "—";
  if (perPack >= 1) return `${perPack.toFixed(perPack >= 10 ? 0 : 1)} per pack`;
  const n = 1 / perPack;
  const rounded = n < 20 ? Math.round(n * 10) / 10 : n < 1000 ? Math.round(n) : Math.round(n / 10) * 10;
  return `1 in ${int.format(rounded)} ${unit}`;
}

// Month names in full: "September 26, 2026", not "Sep 26".
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const longDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
// Timestamps in the reader's own time zone, so they need no zone label.
const localDay = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric" });
const localTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

export function date(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return Number.isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

export function today(): string {
  return longDate.format(new Date());
}

/** "September 25 at 2:10 am", in the reader's time zone. */
export function stamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${localDay.format(d)} at ${localTime.format(d).toLowerCase().replace(/\s/g, " ")}`;
}

/** Relative time for "prices updated 3 hours ago". */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  const m = s / 60;
  if (m < 90) return `${Math.round(m)} minutes ago`;
  const h = m / 60;
  if (h < 36) return `${Math.round(h)} hours ago`;
  return `${Math.round(h / 24)} days ago`;
}

export function isReleased(iso: string, now = new Date()): boolean {
  return new Date(`${iso}T00:00:00Z`).getTime() <= now.getTime();
}

const monthYearFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

/** "October 2026" */
export function monthYear(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : monthYearFmt.format(d);
}
