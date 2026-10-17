import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Collapsing the sidebar changes the width of the map's container without any window resize,
 * and MapLibre only re-measures itself on a window resize. MapView therefore watches its own
 * container. Vitest has no DOM here, so this reads the shipped source.
 */
const ROOT = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const map = read("client/src/components/Map.tsx");
const picker = read("client/src/components/map/LocationPicker.tsx");

describe("MapView resizes with its container", () => {
  it("imports observeSize and binds it to the map container and map.resize()", () => {
    expect(map).toMatch(/import \{ observeSize \} from "@\/lib\/observeSize"/);
    expect(map).toMatch(/observeSize\(mapContainer\.current, \(\) => instance\.resize\(\)\)/);
  });

  it("stops observing before the map is removed", () => {
    const cleanup = map.slice(map.indexOf("return () => {"), map.indexOf("}, [init, unavailable]"));
    expect(cleanup).toContain("stopResize.current?.()");
    expect(cleanup.indexOf("stopResize.current?.()")).toBeGreaterThan(-1);
    expect(cleanup.indexOf("stopResize.current?.()")).toBeLessThan(cleanup.indexOf("map.current?.remove()"));
  });

  it("does not call resize() on every render (only through the observer)", () => {
    expect(map.match(/\.resize\(\)/g)).toHaveLength(1);
  });
});

describe("the location picker keeps its own fallback", () => {
  it("still re-measures once after the dialog opens, in addition to the observer", () => {
    expect(picker).toMatch(/window\.setTimeout\(\(\) => map\.resize\(\), 150\)/);
    expect(picker).toMatch(/<MapView/);
  });
});
