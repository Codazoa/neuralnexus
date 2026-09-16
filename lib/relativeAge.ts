/**
 * Compact relative-age label for feed entries (issue #45): a small number in
 * the top-right of each card showing how long ago the post is from — e.g.
 * `10m`, `1hr`, `10h`, `1d5h`, `3w`, `4mo`, `2y`.
 *
 * Pure function (Date in, string out) so it is deterministic in tests and
 * cheap to call on every card.
 */
function compactNum(n: number, unit: string): string {
  return `${n}${unit}`;
}

/**
 * Format `date` relative to `now`.
 *
 *  - invalid / empty dates      -> ""
 *  - future or just-now         -> "now"
 *  - < 1 hour                   -> "Xm"        (10m, 45m)
 *  - < 1 day                    -> "Xhr"       (1hr, 9hr, 10h)
 *  - < 1 week                   -> "XdYh"      (1d5h, 3d2h)   (plain "N h" when Y=0)
 *  - < 1 month                  -> "XwYd"      (2w3d, 4w)
 *  - < 1 year                   -> "Xmo"       (3mo, 11mo)
 *  - otherwise                  -> "Xy"        (1y, 2y)
 */
export function relativeAge(
  date: Date,
  now: Date = new Date()
): string {
  const then = Number.isNaN(date.getTime()) ? 0 : date.getTime();
  if (!then) return "";
  // Future or just-now -> "now" (never a negative age). After Math.max(0,...),
  // a future date collapses to 0s and falls through here.
  const secs = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (secs < 60) return "now";

  const min = Math.floor(secs / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);
  const month = Math.floor(day / 30);
  const year = Math.floor(day / 365);

  if (day === 0 && hr === 0) return compactNum(Math.max(1, min), "m");
  if (day === 0) return compactNum(hr, "hr");
  if (week === 0) {
    const remHr = hr % 24;
    return remHr === 0
      ? compactNum(day, "d")
      : `${day}d${remHr}h`;
  }
  if (month === 0) {
    const remDay = day % 7;
    return remDay === 0 ? compactNum(week, "w") : `${week}w${remDay}d`;
  }
  if (year === 0) return compactNum(month, "mo");
  return compactNum(year, "y");
}
