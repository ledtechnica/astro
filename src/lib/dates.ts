// Date formatting helpers. The design uses two date forms:
//   "Apr 28, 2026"          — Mmm DD, YYYY (used in post-row date column + article header)
//   datetime="2026-04-28"   — ISO 8601 (used in <time datetime=...> attrs for machine-readable)

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatDate(date: Date): string {
  const m = MONTH_ABBR[date.getUTCMonth()];
  const d = String(date.getUTCDate()).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${m} ${d}, ${y}`;
}

export function toISO(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function readingTime(text: string | undefined | null): number {
  // 220 wpm — the design uses this for "9 min read" etc.
  // Astro 6's Content Layer types `entry.body` as `string | undefined`, so
  // accept the nullable form and degrade to a sensible default.
  if (!text) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 220));
}
