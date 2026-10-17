/**
 * LEAFLET MAP WRAPPER (no API key, no billing, no external script)
 *
 * Leaflet initialises synchronously against the DOM; tiles are plain <img>
 * requests to public tile servers (listed in `vercel.json` img-src).
 *
 *   street  OpenStreetMap standard tiles (Thai place and road names), with the
 *           OSM France "HOT" style as a one-way fallback. In dark mode the street
 *           tiles are inverted by CSS (`.pk-map-dark`) so the map never blinds a
 *           dark-mode user at night.
 *   satellite  Esri World Imagery (for finding a real roof)
 *
 * CARTO Voyager / Dark Matter were tried first and rejected: the unauthenticated
 * `basemaps.cartocdn.com` tiles now come back stamped "API KEY REQUIRED". If
 * traffic ever outgrows OSM's tile usage policy, switch `STREET` to a keyed
 * provider (the key would have to live in a build-time env var).
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

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export type Basemap = "street" | "satellite";
export type MapTheme = "light" | "dark";

interface TileProvider {
  url: string;
  attribution: string;
  subdomains?: string;
  maxZoom: number;
}

const STREET: TileProvider = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: OSM_ATTRIBUTION,
  subdomains: "abc",
  maxZoom: 19,
};
const STREET_FALLBACK: TileProvider = {
  url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  attribution: `${OSM_ATTRIBUTION}, tiles by <a href="https://www.hotosm.org/" target="_blank" rel="noreferrer">HOT</a>`,
  subdomains: "abc",
  maxZoom: 19,
};
const SATELLITE: TileProvider = {
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
  maxZoom: 19,
};

/** The provider chain for a base map: the first entry is used, the rest are one-way fallbacks. */
export function providersFor(basemap: Basemap): TileProvider[] {
  return basemap === "satellite" ? [SATELLITE] : [STREET, STREET_FALLBACK];
}

// How many tile load failures on the current provider before failing over:
// low enough to react quickly, high enough that a few edge/ocean tiles
// (which some providers omit) don't trigger a false failover.
const TILE_ERROR_FAILOVER_THRESHOLD = 6;

/** Adds the provider at `chain[index]` and wires failover to the next one. */
function addTileLayer(map: L.Map, chain: TileProvider[], index: number, onLayer: (layer: L.TileLayer) => void) {
  const provider = chain[index];
  const layer = L.tileLayer(provider.url, {
    maxZoom: provider.maxZoom,
    attribution: provider.attribution,
    ...(provider.subdomains ? { subdomains: provider.subdomains } : {}),
  }).addTo(map);
  onLayer(layer);

  if (index + 1 >= chain.length) return;
  let errorCount = 0;
  layer.on("tileerror", () => {
    errorCount += 1;
    if (errorCount < TILE_ERROR_FAILOVER_THRESHOLD) return;
    map.removeLayer(layer);
    addTileLayer(map, chain, index + 1, onLayer);
  });
}

interface MapViewProps {
  className?: string;
  initialCenter?: L.LatLngLiteral;
  initialZoom?: number;
  basemap?: Basemap;
  theme?: MapTheme;
  onMapReady?: (map: L.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 16.4322, lng: 103.5061 },
  initialZoom = 12,
  basemap = "street",
  theme = "light",
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const tileLayer = useRef<L.TileLayer | null>(null);

  const init = usePersistFn(() => {
    if (!mapContainer.current || map.current) return;

    const instance = L.map(mapContainer.current, {
      center: initialCenter,
      zoom: initialZoom,
      // Set explicitly: the base layer is added after the map exists (it follows the theme), and
      // plugins such as marker clustering read the max zoom before any layer is present.
      maxZoom: 19,
    });
    map.current = instance;
    onMapReady?.(instance);
  });

  useEffect(() => {
    init();
    return () => {
      map.current?.remove();
      map.current = null;
      tileLayer.current = null;
    };
  }, [init]);

  // (Re)draw the base map whenever the style or the theme changes.
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    if (tileLayer.current) instance.removeLayer(tileLayer.current);
    addTileLayer(instance, providersFor(basemap), 0, (layer) => {
      tileLayer.current = layer;
    });
  }, [basemap]);

  // Dark street map = the light OSM tiles inverted in CSS; imagery is left as photographed.
  const dark = theme === "dark" && basemap === "street";
  return <div ref={mapContainer} className={cn("w-full h-[500px]", dark && "pk-map-dark", className)} />;
}
