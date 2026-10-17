/** Pure map helpers: coordinate parsing, formatting and the Google Maps navigation link. */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Kalasin province, used only to centre the map when nothing has coordinates yet. */
export const KALASIN_CENTER: LatLng = { lat: 16.4322, lng: 103.5061 };

const inRange = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const pair = (a: string, b: string): LatLng | null => {
  const lat = Number(a);
  const lng = Number(b);
  return inRange(lat, lng) ? { lat, lng } : null;
};

const NUM = String.raw`-?\d{1,3}(?:\.\d+)?`;

/**
 * Reads a latitude/longitude pair out of whatever a person pastes: plain
 * "16.4322, 103.5061", a Google Maps URL (`@lat,lng`, `?q=lat,lng`, `ll=`,
 * `query=`, `destination=`, or the `!3dLAT!4dLNG` place marker). Returns null
 * when nothing usable is found. Short links (maps.app.goo.gl) carry no
 * coordinates, so they cannot be read here.
 */
export function parseCoordinates(input: string): LatLng | null {
  const text = safeDecode(input).trim();
  if (!text) return null;

  // Google's place marker is the exact pin, so it wins over the viewport centre in `@lat,lng`.
  const place = text.match(new RegExp(String.raw`!3d(${NUM})!4d(${NUM})`));
  if (place) return pair(place[1], place[2]);

  const param = text.match(new RegExp(String.raw`[?&](?:q|ll|query|destination|center)=\+?(${NUM})\s*[,+ ]\s*\+?(${NUM})`));
  if (param) return pair(param[1], param[2]);

  const at = text.match(new RegExp(String.raw`@(${NUM}),\s*(${NUM})`));
  if (at) return pair(at[1], at[2]);

  const plain = text.match(new RegExp(String.raw`^\(?\s*(${NUM})\s*[,;\s]\s*(${NUM})\s*\)?$`));
  if (plain) return pair(plain[1], plain[2]);

  return null;
}

/** `decodeURIComponent` throws on a stray "%"; treat that as plain text. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Six decimals (about 11 cm) is the most a phone GPS can honestly claim. */
export const formatCoordinate = (value: number): string => value.toFixed(6);

/** Both stored values (text columns) as numbers, or null if either is missing or invalid. */
export function toLatLng(latitude: string | null | undefined, longitude: string | null | undefined): LatLng | null {
  if (!latitude || !longitude) return null;
  return pair(latitude, longitude);
}

/** Opens Google Maps directions to the point (the app on a phone, the site elsewhere). */
export function googleMapsDirectionsUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${formatCoordinate(lat)},${formatCoordinate(lng)}`;
}

/**
 * One colour per body (บอดี้). Hues are spread for map legibility on both the
 * light and dark base maps, and the legend always names the body, so colour is
 * never the only carrier of meaning.
 */
export const BODY_COLORS = ["#e8560a", "#2563eb", "#16a34a", "#9333ea", "#0891b2", "#db2777", "#ca8a04", "#475569"] as const;
export const NO_BODY_COLOR = "#6b7280";

export const bodyColor = (index: number): string => (index < 0 ? NO_BODY_COLOR : BODY_COLORS[index % BODY_COLORS.length]);
