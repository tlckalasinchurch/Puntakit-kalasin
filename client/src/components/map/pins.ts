import L from "leaflet";

/**
 * Map pins. A visible dot wrapped in a larger invisible hit area, so the marker
 * reads as a normal pin but still meets the 44px touch-target minimum.
 *
 * Plain inline styles, not Tailwind classes: the HTML string is handed to
 * Leaflet, which mounts it outside Tailwind's stylesheet scan. `color` is a
 * literal hex (a body's identity colour) because it must be identical on the
 * light, dark and satellite base maps; the white ring keeps it visible on all.
 */
export const PIN_HIT_SIZE = 44;

export function pinHtml({ visibleSize, label, color }: { visibleSize: number; label?: string; color: string }) {
  const hitSize = Math.max(PIN_HIT_SIZE, visibleSize);
  const fontSize = visibleSize >= 40 ? 13 : 11;
  return `
    <div style="width:${hitSize}px;height:${hitSize}px;display:flex;align-items:center;justify-content:center;cursor:pointer;">
      <div style="width:${visibleSize}px;height:${visibleSize}px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Prompt',system-ui,sans-serif;font-weight:700;font-size:${fontSize}px;line-height:1;">
        ${label ?? ""}
      </div>
    </div>
  `;
}

export function pinDivIcon(options: { visibleSize: number; label?: string; color: string }) {
  const hitSize = Math.max(PIN_HIT_SIZE, options.visibleSize);
  return L.divIcon({
    html: pinHtml(options),
    className: "", // clear Leaflet's default divIcon class (white box + border)
    iconSize: [hitSize, hitSize],
    iconAnchor: [hitSize / 2, hitSize / 2],
  });
}
