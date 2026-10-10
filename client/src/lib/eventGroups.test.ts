import { describe, expect, it } from "vitest";
import { daysUntil, groupEvents } from "./eventGroups";

const NOW = new Date(2026, 9, 10, 15, 30); // 10 Oct 2026, 15:30 local

const ev = (
  id: string,
  date: Date,
  status: "scheduled" | "cancelled" | "completed" = "scheduled"
) => ({ id, eventDate: date.toISOString(), status });

describe("groupEvents", () => {
  it("puts the soonest scheduled event first and keeps the rest ascending", () => {
    const g = groupEvents(
      [
        ev("c", new Date(2026, 9, 25, 9)),
        ev("a", new Date(2026, 9, 12, 9)),
        ev("b", new Date(2026, 9, 18, 9)),
      ],
      NOW
    );
    expect(g.next?.id).toBe("a");
    expect(g.upcoming.map(e => e.id)).toEqual(["b", "c"]);
    expect(g.past).toEqual([]);
    expect(g.cancelled).toEqual([]);
  });

  it("treats an event earlier today as still upcoming", () => {
    const g = groupEvents([ev("today", new Date(2026, 9, 10, 8))], NOW);
    expect(g.next?.id).toBe("today");
  });

  it("sends completed and stale scheduled events to past, newest first", () => {
    const g = groupEvents(
      [
        ev("old", new Date(2026, 8, 1), "completed"),
        ev("stale", new Date(2026, 9, 3)),
        ev("done", new Date(2026, 9, 5), "completed"),
      ],
      NOW
    );
    expect(g.next).toBeNull();
    expect(g.past.map(e => e.id)).toEqual(["done", "stale", "old"]);
  });

  it("keeps cancelled events out of upcoming even when they are in the future", () => {
    const g = groupEvents(
      [
        ev("x", new Date(2026, 9, 20), "cancelled"),
        ev("y", new Date(2026, 9, 14)),
      ],
      NOW
    );
    expect(g.next?.id).toBe("y");
    expect(g.cancelled.map(e => e.id)).toEqual(["x"]);
  });

  it("does not drop or duplicate anything", () => {
    const items = [
      ev("1", new Date(2026, 9, 11)),
      ev("2", new Date(2026, 8, 11), "completed"),
      ev("3", new Date(2026, 9, 30), "cancelled"),
      ev("4", new Date(2026, 9, 2)),
    ];
    const g = groupEvents(items, NOW);
    const all = [g.next, ...g.upcoming, ...g.past, ...g.cancelled]
      .filter(Boolean)
      .map(e => e!.id)
      .sort();
    expect(all).toEqual(["1", "2", "3", "4"]);
  });

  it("returns empty groups for no events", () => {
    expect(groupEvents([], NOW)).toEqual({
      next: null,
      upcoming: [],
      past: [],
      cancelled: [],
    });
  });
});

describe("daysUntil", () => {
  it("counts calendar days regardless of time of day", () => {
    expect(daysUntil(new Date(2026, 9, 10, 1).toISOString(), NOW)).toBe(0);
    expect(daysUntil(new Date(2026, 9, 11, 23).toISOString(), NOW)).toBe(1);
    expect(daysUntil(new Date(2026, 9, 17, 9).toISOString(), NOW)).toBe(7);
  });
});
