/**
 * MapLibre draws with WebGL. Some embedded WebViews and older phones cannot create a
 * context at all; the map then shows a plain message with a Google Maps link instead of
 * a blank box. Checked on a throw-away canvas so no context is leaked into the page.
 */
export function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const ok = Boolean(context);
    // Free the probe's context right away (browsers cap how many may be alive).
    (context as WebGLRenderingContext | null)?.getExtension("WEBGL_lose_context")?.loseContext();
    return ok;
  } catch {
    return false;
  }
}
