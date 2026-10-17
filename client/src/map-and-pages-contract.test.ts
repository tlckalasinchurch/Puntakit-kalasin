import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// Source-level contracts for the real GIS map and the page-level fixes that
// shipped with it (same style as the other client contract tests).
const root = path.resolve(import.meta.dirname, "..", "..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

describe("map engine and base layers", () => {
  const map = read("client/src/components/Map.tsx");

  it("is MapLibre GL, with OpenFreeMap liberty (light) and dark styles and Esri World Imagery for satellite", () => {
    expect(map).toContain('from "maplibre-gl"');
    expect(map).toContain("https://tiles.openfreemap.org/styles");
    expect(map).toMatch(/theme === "dark" \? "dark" : "liberty"/);
    expect(map).toContain("server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}");
    expect(map).toMatch(/basemap === "satellite"\) return SATELLITE_STYLE/);
    expect(map).toContain("map.current?.setStyle(next)");
  });

  it("points MapLibre at its worker file explicitly (its default lookup breaks under Vite)", () => {
    expect(map).toContain('from "maplibre-gl/dist/maplibre-gl-worker.mjs?url"');
    expect(map).toContain("maplibregl.setWorkerUrl(workerUrl)");
  });

  it("no longer ships Leaflet or CARTO", () => {
    for (const rel of ["client/src/components/Map.tsx", "client/src/pages/Map.tsx", "client/src/components/map/LocationPicker.tsx", "client/src/components/map/pins.ts"]) {
      expect(read(rel), rel).not.toMatch(/from "leaflet|leaflet\./);
    }
    const pkg = read("package.json");
    expect(pkg).toContain('"maplibre-gl"');
    expect(pkg).not.toMatch(/"leaflet/);
    expect(map).not.toContain("cartocdn");
  });

  it("falls back to a message with a Google Maps link when WebGL is missing", () => {
    expect(map).toContain("useState(() => !hasWebGL())");
    expect(map).toContain("<MapUnavailable");
    const fallback = read("client/src/components/map/MapUnavailable.tsx");
    expect(fallback).toContain("https://www.google.com/maps/");
    expect(fallback).toContain('data-testid="map-unavailable"');
    expect(read("client/src/lib/webgl.ts")).toMatch(/getContext\("webgl2"\)/);
  });

  it("the CSP lets the style, tiles, glyphs, imagery and workers load", () => {
    const csp = read("vercel.json");
    const dir = (name: string) => csp.match(new RegExp(`${name}[^;]*`))![0];
    expect(dir("img-src")).toContain("https://tiles.openfreemap.org");
    expect(dir("img-src")).toContain("https://server.arcgisonline.com");
    expect(dir("connect-src")).toContain("https://tiles.openfreemap.org");
    expect(dir("worker-src")).toContain("blob:");
    expect(csp).not.toContain("cartocdn");
  });
});

describe("/map page", () => {
  const page = read("client/src/pages/Map.tsx");

  it("follows the app theme, offers the satellite toggle and colours pins by body", () => {
    expect(page).toContain("theme={theme}");
    expect(page).toContain("basemap={basemap}");
    expect(page).toContain("<BasemapToggle");
    expect(page).toContain("color: colorOf(group)");
    expect(page).toContain("clusterPoints(placed, CLUSTER_RADIUS_PX)");
    expect(page).toContain('aria-label="กรองตามบอดี้"');
  });

  it("keeps the basemap toggle below the detail sheet (isolated stacking context, low z-index)", () => {
    expect(read("client/src/components/map/BasemapToggle.tsx")).not.toMatch(/z-\[\d{3,}\]/);
    expect(page).toContain('className="relative isolate"');
    expect(read("client/src/components/map/LocationPicker.tsx")).toContain('className="relative isolate"');
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

describe("group place photo and details (client)", () => {
  it("uploads through the group_photo media kind and stores it as the group's cover", () => {
    expect(read("client/src/lib/imageUpload.ts")).toContain("/api/media?kind=group_photo&groupId=");
    expect(read("shared/schema.ts")).toContain('"group_photo"');
  });

  it("the map card shows the photo and the details, and editors can change the photo", () => {
    const page = read("client/src/pages/Map.tsx");
    expect(page).toContain("<GroupPhotoField");
    expect(page).toContain("canEdit={canEdit}");
    expect(page).toContain("รายละเอียดและจุดสังเกต");
    expect(page).toContain("coverUrl: string | null");
    const field = read("client/src/components/groups/GroupPhotoField.tsx");
    expect(field).toContain("if (!hasPhoto && !canEdit) return null"); // no empty frame for viewers
    expect(field).toContain("onError={() => setFailed(true)}"); // a broken image hides itself
  });

  it("the group form offers the photo (after the group exists) and the details field", () => {
    const groups = read("client/src/pages/Groups.tsx");
    expect(groups).toContain("<GroupPhotoField");
    expect(groups).toContain("รายละเอียดและจุดสังเกต");
    expect(groups).toContain("เพิ่มรูปสถานที่ได้หลังสร้างกลุ่มแล้ว");
  });
});
