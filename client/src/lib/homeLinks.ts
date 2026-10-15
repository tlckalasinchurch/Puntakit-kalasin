export interface HomeLink {
  href: string;
  label: string;
}

/**
 * Base links first, then role-specific links whose destination is not already
 * reachable (as a base link or as a tile). Nothing a role could reach before
 * is dropped: a duplicate only disappears when the same href stays visible.
 */
export function mergeHomeLinks(
  base: HomeLink[],
  extras: HomeLink[],
  tileHrefs: ReadonlySet<string>
): HomeLink[] {
  const seen = new Set(base.map(l => l.href));
  tileHrefs.forEach(href => seen.add(href));
  const out = [...base];
  for (const link of extras) {
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    out.push(link);
  }
  return out;
}
