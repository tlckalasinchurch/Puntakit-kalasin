/**
 * LEAFLET + OPENSTREETMAP-FAMILY MAP WRAPPER
 *
 * Renders a map with no API key, no billing, and no external script load —
 * Leaflet initializes synchronously against the DOM, and tiles are plain
 * <img> requests to a public tile CDN (see TILE_PROVIDERS below, with
 * automatic failover to the next entry if one stops serving tiles).
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 * const mapRef = useRef<L.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 16.4322, lng: 103.5061 }}
 *   initialZoom={12}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Leaflet itself owns re-rendering, not React state.
 *   }}
 * />
 */

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { usePersistFn } from "@/hooks/usePersistFn";
import { cn } from "@/lib/utils";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

// CartoDB's Positron tiles are the primary provider: no key, CDN-backed and
// meant for exactly this (embedding in a third-party app, unlike OSM's own
// tile servers, which ask high-traffic apps not to hotlink them directly),
// and its muted light style fits the V2 quiet aesthetic better than OSM's
// default saturated one. OSM is the automatic fallback if tiles fail to load
// (e.g. a network that blocks CartoDB specifically) — swapping the whole
// layer on repeated tileerror, not per-tile, to avoid flicker.
const TILE_PROVIDERS = [
  {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>`,
    subdomains: "abcd",
  },
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: OSM_ATTRIBUTION,
    subdomains: "abc",
  },
] as const;
const TILE_LAYER_MAX_ZOOM = 19;
// How many tile load failures on the current provider before failing over —
// low enough to react quickly, high enough that a few edge/ocean tiles
// (which some providers omit) don't trigger a false failover.
const TILE_ERROR_FAILOVER_THRESHOLD = 6;

// Adds a tile layer for TILE_PROVIDERS[providerIndex] and wires up failover:
// once TILE_ERROR_FAILOVER_THRESHOLD tiles from this layer fail, it's
// replaced with the next provider in the list (a one-way trip — no bouncing
// back and forth if both are having a bad day).
function addTileLayer(map: L.Map, providerIndex: number) {
  const provider = TILE_PROVIDERS[providerIndex];
  const layer = L.tileLayer(provider.url, {
    maxZoom: TILE_LAYER_MAX_ZOOM,
    attribution: provider.attribution,
    subdomains: provider.subdomains,
  }).addTo(map);

  const nextProviderIndex = providerIndex + 1;
  if (nextProviderIndex >= TILE_PROVIDERS.length) return layer;

  let errorCount = 0;
  layer.on("tileerror", () => {
    errorCount += 1;
    if (errorCount < TILE_ERROR_FAILOVER_THRESHOLD) return;
    map.removeLayer(layer);
    addTileLayer(map, nextProviderIndex);
  });
  return layer;
}

interface MapViewProps {
  className?: string;
  initialCenter?: L.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 16.4322, lng: 103.5061 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);

  const init = usePersistFn(() => {
    if (!mapContainer.current || map.current) return;

    const instance = L.map(mapContainer.current, {
      center: initialCenter,
      zoom: initialZoom,
    });
    addTileLayer(instance, 0);

    map.current = instance;
    onMapReady?.(instance);
  });

  useEffect(() => {
    init();
    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [init]);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
