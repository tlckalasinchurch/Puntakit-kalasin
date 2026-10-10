/**
 * Presentation-only grouping for the Events page. It reads fields every event
 * already has (`eventDate`, `status`) and decides nothing about the event
 * itself: no status is changed and no rule is added.
 *
 * - upcoming: scheduled, and on or after the start of today (local time)
 * - past: completed, or scheduled but dated before today (the chip on the row
 *   still says "กำหนดการ", so a stale status stays visible)
 * - cancelled: cancelled, regardless of date
 */
export interface EventLike {
  id: string;
  eventDate: string;
  status: "scheduled" | "cancelled" | "completed";
}

export interface EventGroups<T extends EventLike> {
  /** The soonest upcoming event, shown as the feature. */
  next: T | null;
  /** Upcoming events after `next`, soonest first. */
  upcoming: T[];
  /** Newest first. */
  past: T[];
  /** Newest first. */
  cancelled: T[];
}

export function startOfLocalDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ).getTime();
}

const time = (iso: string) => new Date(iso).getTime();

export function groupEvents<T extends EventLike>(
  items: readonly T[],
  now: Date = new Date()
): EventGroups<T> {
  const today = startOfLocalDay(now);
  const upcomingAll: T[] = [];
  const past: T[] = [];
  const cancelled: T[] = [];

  for (const ev of items) {
    if (ev.status === "cancelled") cancelled.push(ev);
    else if (ev.status === "scheduled" && time(ev.eventDate) >= today)
      upcomingAll.push(ev);
    else past.push(ev);
  }

  upcomingAll.sort((a, b) => time(a.eventDate) - time(b.eventDate));
  past.sort((a, b) => time(b.eventDate) - time(a.eventDate));
  cancelled.sort((a, b) => time(b.eventDate) - time(a.eventDate));

  const [next = null, ...upcoming] = upcomingAll;
  return { next, upcoming, past, cancelled };
}

/** Whole calendar days from today to the event (0 = today). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((startOfLocalDay(new Date(iso)) - startOfLocalDay(now)) / day);
}
