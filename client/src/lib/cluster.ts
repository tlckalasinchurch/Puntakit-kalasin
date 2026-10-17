/**
 * Greedy distance clustering in SCREEN pixels. MapLibre pins here are DOM markers (so they
 * survive a style swap between light, dark and satellite), which means clustering is done
 * by us: project every point at the current zoom, then merge points that land within
 * `radius` pixels of a cluster's centre. A few hundred points at most, so O(n * k) is fine.
 */
export interface ClusterInput<T> {
  item: T;
  x: number;
  y: number;
}

export interface Cluster<T> {
  items: T[];
  /** The centroid, in the same pixel space as the input. */
  x: number;
  y: number;
}

export function clusterPoints<T>(points: readonly ClusterInput<T>[], radius: number): Cluster<T>[] {
  const clusters: Cluster<T>[] = [];
  const limit = radius * radius;
  for (const point of points) {
    const near = clusters.find((c) => (c.x - point.x) ** 2 + (c.y - point.y) ** 2 <= limit);
    if (!near) {
      clusters.push({ items: [point.item], x: point.x, y: point.y });
      continue;
    }
    const n = near.items.length;
    near.x = (near.x * n + point.x) / (n + 1);
    near.y = (near.y * n + point.y) / (n + 1);
    near.items.push(point.item);
  }
  return clusters;
}
