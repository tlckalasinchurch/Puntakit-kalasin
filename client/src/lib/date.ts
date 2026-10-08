/**
 * Date helpers shared by the Thai date field. Kept as pure functions (no
 * React, no CSS) so they can be unit-tested in isolation.
 *
 * The app stores dates as `YYYY-MM-DD` strings and *displays* them in Thai with
 * a Gregorian (ค.ศ.) year.
 */

/** `YYYY-MM-DD` -> a local `Date`, or `undefined` when empty/unparseable. */
export function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return undefined;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day);
  // `new Date` silently rolls over (e.g. Feb 30 -> Mar 2); reject that.
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return undefined;
  }
  return date;
}

/** A local `Date` -> `YYYY-MM-DD`, always using local (never UTC) parts. */
export function dateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` -> Thai display with Gregorian year ("4 ต.ค. 2026"), or "" when empty. */
export function formatThaiDate(iso: string): string {
  const date = isoToDate(iso);
  if (!date) return "";
  const day = date.getDate();
  const month = date.toLocaleDateString("th-TH", { month: "short" });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}
