import * as maplibregl from "maplibre-gl";

/**
 * Map pins as real DOM buttons. A visible dot sits inside a larger invisible hit area, so a
 * pin reads as a normal marker but still meets the 44px touch-target minimum, and being a
 * <button> it is reachable and activatable from the keyboard.
 *
 * Inline styles, not Tailwind classes: these elements are created outside React. `color` is a
 * literal hex (a body's identity colour) because it must be identical on the light, dark and
 * satellite base maps; the white ring keeps it visible on all of them.
 */
export const PIN_HIT_SIZE = 44;

export interface PinOptions {
  visibleSize: number;
  color: string;
  /** Short text in the dot (a cluster count). */
  label?: string;
  /** Accessible name. */
  title: string;
  onClick?: () => void;
}

export function createPinElement({ visibleSize, color, label, title, onClick }: PinOptions): HTMLButtonElement {
  const hit = Math.max(PIN_HIT_SIZE, visibleSize);
  const button = document.createElement("button");
  button.type = "button";
  button.title = title;
  button.setAttribute("aria-label", title);
  Object.assign(button.style, {
    width: `${hit}px`,
    height: `${hit}px`,
    padding: "0",
    border: "0",
    background: "transparent",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  });

  const dot = document.createElement("span");
  dot.setAttribute("aria-hidden", "true");
  Object.assign(dot.style, {
    width: `${visibleSize}px`,
    height: `${visibleSize}px`,
    borderRadius: "50%",
    background: color,
    border: "3px solid #fff",
    boxShadow: "0 1px 5px rgba(0,0,0,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontFamily: "'Prompt', system-ui, sans-serif",
    fontWeight: "700",
    fontSize: visibleSize >= 40 ? "13px" : "11px",
    lineHeight: "1",
  });
  if (label) dot.textContent = label;
  button.appendChild(dot);
  if (onClick) button.addEventListener("click", onClick);
  return button;
}

/** A marker centred on the point. */
export function createPinMarker(options: PinOptions & { draggable?: boolean }): maplibregl.Marker {
  const { draggable, ...pin } = options;
  return new maplibregl.Marker({ element: createPinElement(pin), anchor: "center", draggable: draggable ?? false });
}
