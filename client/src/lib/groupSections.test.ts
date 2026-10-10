import { describe, expect, it } from "vitest";
import { sectionGroups, type GroupLike } from "./groupSections";

const g = (
  id: string,
  orgLevel: GroupLike["orgLevel"],
  parentGroupId: string | null = null
): GroupLike => ({ id, name: `กลุ่ม ${id}`, orgLevel, parentGroupId });

const BODIES = [
  { id: "b1", name: "บอดี้ 1" },
  { id: "b2", name: "บอดี้ 2" },
];

describe("sectionGroups", () => {
  it("nests care groups under their body and keeps body order", () => {
    const visible = [
      g("c3", "care", "b2"),
      g("c1", "care", "b1"),
      g("c2", "care", "b1"),
      g("b1", "body"),
    ];
    const r = sectionGroups(visible, BODIES);
    expect(r.sections.map(s => s.body.id)).toEqual(["b1", "b2"]);
    expect(r.sections[0].bodyItem?.id).toBe("b1");
    expect(r.sections[0].children.map(c => c.id)).toEqual(["c1", "c2"]);
    expect(r.sections[1].bodyItem).toBeNull();
    expect(r.sections[1].children.map(c => c.id)).toEqual(["c3"]);
  });

  it("still groups under a body that is hidden by the level filter", () => {
    const r = sectionGroups([g("c1", "care", "b1")], BODIES);
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].bodyItem).toBeNull();
    expect(r.sections[0].body.name).toBe("บอดี้ 1");
  });

  it("separates care groups without a known parent and groups outside the org chart", () => {
    const r = sectionGroups(
      [g("c1", "care"), g("c2", "care", "ghost"), g("x1", null)],
      BODIES
    );
    expect(r.sections).toEqual([]);
    expect(r.unparentedCare.map(c => c.id)).toEqual(["c1", "c2"]);
    expect(r.others.map(c => c.id)).toEqual(["x1"]);
  });

  it("uses a visible body even when the bodies list does not have it", () => {
    const r = sectionGroups([g("b9", "body")], []);
    expect(r.sections.map(s => s.body.id)).toEqual(["b9"]);
  });

  it("places every visible group exactly once", () => {
    const visible = [
      g("b1", "body"),
      g("c1", "care", "b1"),
      g("c2", "care"),
      g("x1", null),
    ];
    const r = sectionGroups(visible, BODIES);
    const placed = [
      ...r.sections.flatMap(s => [s.bodyItem, ...s.children]),
      ...r.unparentedCare,
      ...r.others,
    ]
      .filter(Boolean)
      .map(x => x!.id)
      .sort();
    expect(placed).toEqual(["b1", "c1", "c2", "x1"]);
  });
});
