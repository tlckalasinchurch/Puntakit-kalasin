/**
 * MAPLIBRE GL JS MAP WRAPPER
 *
 * Vector map rendered with WebGL by MapLibre, no API key and no billing:
 *
 *   street light  OpenFreeMap "liberty"
 *   street dark   OpenFreeMap "dark"
 *   satellite     Esri World Imagery (a raster source in an inline style)
 *
 * The style follows the app theme. Pins are DOM markers (see `pins.ts`), which a
 * `setStyle()` between light, dark and satellite does not touch. When WebGL is not
 * available (some WebViews) the wrapper renders `MapUnavailable` instead of an empty box.
 *
 * USAGE FROM PARENT COMPONENT:
 *
 * <MapView
 *   basemap={satellite ? "satellite" : "street"}
 *   theme={theme}
 *   initialCenter={{ lat: 16.4322, lng: 103.5061 }}
 *   initialZoom={11}
 *   onMapReady={(map) => { mapRef.current = map; }}
 * />
 */

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// MapLibre 6 finds its worker next to its own file, which is wrong once Vite pre-bundles or
// chunks it (dev: .vite/deps, production: /assets). Point it at the real worker file explicitly.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { MapUnavailable } from "@/components/map/MapUnavailable";
import { usePersistFn } from "@/hooks/usePersistFn";
import { hasWebGL } from "@/lib/webgl";
import { cn } from "@/lib/utils";

maplibregl.setWorkerUrl(workerUrl);

export type Basemap = "street" | "satellite";
export type MapTheme = "light" | "dark";

const OPENFREEMAP = "https://tiles.openfreemap.org/styles";

/** Esri imagery has no labels or text layers, so this style needs no glyphs or sprite. */
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
  },
  layers: [{ id: "esri-imagery", type: "raster", source: "esri" }],
};

export function styleFor(basemap: Basemap, theme: MapTheme): string | StyleSpecification {
  if (basemap === "satellite") return SATELLITE_STYLE;
  return `${OPENFREEMAP}/${theme === "dark" ? "dark" : "liberty"}`;
}

interface MapViewProps {
  className?: string;
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  basemap?: Basemap;
  theme?: MapTheme;
  /** Where the "open in Google Maps" link of the no-WebGL fallback should go. */
  fallbackTarget?: { lat: number; lng: number } | null;
  onMapReady?: (map: maplibregl.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 16.4322, lng: 103.5061 },
  initialZoom = 12,
  basemap = "street",
  theme = "light",
  fallbackTarget = null,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const style = useRef<string | StyleSpecification>(styleFor(basemap, theme));
  const [unavailable, setUnavailable] = useState(() => !hasWebGL());

  const init = usePersistFn(() => {
    if (unavailable || !mapContainer.current || map.current) return;
    try {
      const instance = new maplibregl.Map({
        container: mapContainer.current,
        style: style.current,
        center: [initialCenter.lng, initialCenter.lat],
        zoom: initialZoom,
        maxZoom: 19,
        attributionControl: { compact: true },
      });
      instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
      map.current = instance;
      onMapReady?.(instance);
    } catch {
      // A context that probed fine can still fail to initialise (low memory, lost context).
      setUnavailable(true);
    }
  });

  useEffect(() => {
    init();
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [init, unavailable]);

  // Swap the base style when the theme or the street/satellite choice changes.
  useEffect(() => {
    const next = styleFor(basemap, theme);
    if (next === style.current) return;
    style.current = next;
    map.current?.setStyle(next);
  }, [basemap, theme]);

  if (unavailable) return <MapUnavailable className={className} target={fallbackTarget} />;
  return <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />;
}
