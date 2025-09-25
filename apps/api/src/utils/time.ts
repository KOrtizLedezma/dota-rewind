export type RangeKey = "last_month" | "last_6_months" | "last_year";

export function rangeKeyToDays(range: RangeKey): number {
  if (range === "last_month") return 30;
  if (range === "last_6_months") return 180;
  return 365;
}

export function rangeUnixBounds(days: number) {
  const end = Math.floor(Date.now() / 1000);
  const start = end - days * 24 * 3600;
  return { start, end };
}
