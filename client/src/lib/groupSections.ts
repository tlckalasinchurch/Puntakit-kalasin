/**
 * Presentation-only grouping for the Groups page: care groups ("พันธกิจ") are
 * shown under the body ("บอดี้") they already point to through
 * `parentGroupId`. Nothing here reads or invents data beyond `orgLevel` and
 * `parentGroupId`, and nothing is filtered out: every visible group lands in
 * exactly one place.
 */
export interface GroupLike {
  id: string;
  name: string;
  orgLevel: "body" | "care" | null;
  parentGroupId: string | null;
}

export interface BodySection<T extends GroupLike> {
  body: { id: string; name: string };
  /** The body's own row, when it is among the visible groups. */
  bodyItem: T | null;
  children: T[];
}

export interface GroupSections<T extends GroupLike> {
  sections: BodySection<T>[];
  /** Care groups with no (known) parent body. */
  unparentedCare: T[];
  /** Groups outside the org chart (no `orgLevel`). */
  others: T[];
}

export function sectionGroups<T extends GroupLike>(
  visible: readonly T[],
  bodies: readonly { id: string; name: string }[]
): GroupSections<T> {
  const bodyById = new Map(bodies.map(b => [b.id, { id: b.id, name: b.name }]));
  for (const g of visible) {
    if (g.orgLevel === "body" && !bodyById.has(g.id)) {
      bodyById.set(g.id, { id: g.id, name: g.name });
    }
  }

  const bodyItems = new Map<string, T>();
  const children = new Map<string, T[]>();
  const unparentedCare: T[] = [];
  const others: T[] = [];

  for (const g of visible) {
    if (g.orgLevel === "body") {
      bodyItems.set(g.id, g);
    } else if (g.orgLevel === "care") {
      if (g.parentGroupId && bodyById.has(g.parentGroupId)) {
        const list = children.get(g.parentGroupId) ?? [];
        list.push(g);
        children.set(g.parentGroupId, list);
      } else {
        unparentedCare.push(g);
      }
    } else {
      others.push(g);
    }
  }

  const sections: BodySection<T>[] = [];
  for (const body of Array.from(bodyById.values())) {
    const bodyItem = bodyItems.get(body.id) ?? null;
    const kids = children.get(body.id) ?? [];
    if (bodyItem || kids.length > 0) {
      sections.push({ body, bodyItem, children: kids });
    }
  }
  return { sections, unparentedCare, others };
}
