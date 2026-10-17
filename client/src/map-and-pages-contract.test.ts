import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Source-level contracts for the real GIS map and the page-level fixes that
// shipped with it (same style as the other client contract tests).
const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("map base layers", () => {
  const map = read("client/src/components/Map.tsx");

  it("uses OSM for streets (inverted in dark mode) and Esri World Imagery for satellite", () => {
    expect(map).toContain("tile.openstreetmap.org/{z}/{x}/{y}.png");
    expect(map).toContain("server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
    expect(map).toMatch(/basemap === "satellite" \? \[SATELLITE\] : \[STREET, STREET_FALLBACK\]/);
    expect(map).toMatch(/theme === "dark" && basemap === "street"/);
    expect(read("client/src/index.css")).toMatch(/\.pk-map-dark \.leaflet-tile-pane \{[^}]*invert\(1\)/);
  });

  it("does not use CARTO tiles, which return an API-key watermark without a key", () => {
    expect(map).not.toMatch(/https:\/\/\{s\}\.basemaps\.cartocdn\.com/);
  });

  it("sets maxZoom on the map itself, because the base layer is added after the map exists", () => {
    expect(map).toMatch(/L\.map\(mapContainer\.current,\s*\{[^}]*maxZoom:\s*19/);
  });

  it("the CSP lets every tile host load", () => {
    const imgSrc = read("vercel.json").match(/img-src[^;]*/)![0];
    for (const host of ["tile.openstreetmap.org", "tile.openstreetmap.fr", "server.arcgisonline.com"]) {
      expect(imgSrc, host).toContain(host);
    }
    expect(imgSrc).not.toContain("cartocdn");
  });
});

describe("/map page", () => {
  const page = read("client/src/pages/Map.tsx");

  it("follows the app theme, offers the satellite toggle and colours pins by body", () => {
    expect(page).toContain("theme={theme}");
    expect(page).toContain("basemap={basemap}");
    expect(page).toContain("<BasemapToggle");
    expect(page).toContain("pinDivIcon({ visibleSize: 28, color: colorOf(group) })");
    expect(page).toContain('aria-label="กรองตามบอดี้"');
  });

  it("shows only groups that have real coordinates, and never invents any", () => {
    expect(page).toContain("filtered.filter(g => g.latitude && g.longitude)");
    expect(page).not.toMatch(/lat:\s*1[0-9]\.\d+\s*,\s*lng/); // no hard-coded demo points
  });

  it("every detail card can navigate with Google Maps and (for people who may) edit the pin", () => {
    expect(page).toContain("นำทางด้วย Google Maps");
    expect(page).toContain("googleMapsDirectionsUrl(point)");
    expect(page).toContain("GROUP_MANAGE_ANY_ROLES");
    expect(page).toMatch(/api\.put\(`\/api\/groups\/\$\{group\.id\}`, \{ latitude, longitude \}\)/);
  });
});

describe("location picker", () => {
  const picker = read("client/src/components/map/LocationPicker.tsx");

  it("offers all three ways to pin a real place", () => {
    expect(picker).toContain("navigator.geolocation.getCurrentPosition"); // 1. phone GPS
    expect(picker).toMatch(/draggable:\s*true/); // 2. drag the pin
    expect(picker).toContain('map.on("click"'); //    ...or tap the map
    expect(picker).toContain("parseCoordinates("); // 3. pasted link or "lat, lng"
  });

  it("is wired into the group edit form, which only fills the form fields", () => {
    const groups = read("client/src/pages/Groups.tsx");
    expect(groups).toContain("<LocationPicker");
    expect(groups).toContain("ปักหมุดบนแผนที่");
  });
});

describe("page-level fixes", () => {
  it("CSV exports download in place instead of opening a new window", () => {
    for (const rel of ["Attendance", "Members", "Reports"]) {
      const src = read(`client/src/pages/${rel}.tsx`);
      expect(src, rel).toContain("downloadFile(");
      expect(src, rel).not.toMatch(/window\.open\([^)]*export/);
    }
    expect(read("client/src/lib/download.ts")).toContain("anchor.download");
  });

  it("/privacy, /terms, 404 and the permission-denied screens are wrapped in <main>", () => {
    for (const rel of ["pages/Privacy.tsx", "pages/Terms.tsx", "pages/NotFound.tsx"]) {
      expect(read(`client/src/${rel}`), rel).toMatch(/<main\b/);
    }
    const guard = read("client/src/components/ProtectedRoute.tsx");
    expect(guard).toMatch(/<main[^>]*\s*data-testid="route-denied"/);
    expect(guard).toMatch(/<main[\s\S]{0,200}data-testid="auth-error"/);
    expect(guard).not.toContain("min-h-screen");
  });

  it("the events header hides its create button while the empty state shows one", () => {
    const events = read("client/src/pages/Events.tsx");
    expect(events).toContain("isAdmin && (isLoading || error || items.length > 0)");
  });

  it("lamb illustrations are rounded tiles with a dark-mode ring, and /care no longer nests a screen in a card", () => {
    expect(read("client/src/components/lamb/LambMascot.tsx")).toContain("lamb-art");
    const css = read("client/src/index.css");
    expect(css).toMatch(/\.dark \.lamb-art \{[^}]*box-shadow/);
    expect(css).toMatch(/\.clay-screen \{ background: transparent/);
  });
});
