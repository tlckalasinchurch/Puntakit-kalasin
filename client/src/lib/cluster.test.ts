import { describe, expect, it } from "vitest";
import { clusterPoints } from "./cluster";

const p = (item: string, x: number, y: number) => ({ item, x, y });

describe("clusterPoints", () => {
  it("keeps far-apart points separate", () => {
    const clusters = clusterPoints([p("a", 0, 0), p("b", 200, 0), p("c", 0, 300)], 56);
    expect(clusters.map((c) => c.items)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("merges points within the radius and puts the centroid between them", () => {
    const [cluster, ...rest] = clusterPoints([p("a", 0, 0), p("b", 40, 0)], 56);
    expect(rest).toEqual([]);
    expect(cluster.items).toEqual(["a", "b"]);
    expect(cluster.x).toBe(20);
    expect(cluster.y).toBe(0);
  });

  it("treats the radius as inclusive and is deterministic", () => {
    const input = [p("a", 0, 0), p("b", 56, 0), p("c", 300, 300)];
    expect(clusterPoints(input, 56).map((c) => c.items)).toEqual([["a", "b"], ["c"]]);
    expect(clusterPoints(input, 56)).toEqual(clusterPoints(input, 56));
    expect(clusterPoints(input, 55.9).map((c) => c.items)).toEqual([["a"], ["b"], ["c"]]);
  });

  it("handles no points and identical points", () => {
    expect(clusterPoints([], 56)).toEqual([]);
    expect(clusterPoints([p("a", 5, 5), p("b", 5, 5)], 56)[0].items).toEqual(["a", "b"]);
  });
});
