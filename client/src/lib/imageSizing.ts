/** Sizing maths for browser-side image resizing — pure, so it is unit-tested without a DOM. */

export interface PrepareOptions {
  /** Longest edge after resizing. */
  maxEdge: number;
  /** Centre-crop to this width/height ratio (e.g. 4/5 for a card portrait). */
  aspect?: number;
  quality?: number;
}

export function planImageSize(
  srcW: number,
  srcH: number,
  { maxEdge, aspect }: Pick<PrepareOptions, "maxEdge" | "aspect">
): { sx: number; sy: number; sw: number; sh: number; dw: number; dh: number } {
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;
  if (aspect) {
    const srcAspect = srcW / srcH;
    if (srcAspect > aspect) {
      sw = Math.round(srcH * aspect);
      sx = Math.round((srcW - sw) / 2);
    } else {
      sh = Math.round(srcW / aspect);
      sy = Math.round((srcH - sh) / 2);
    }
  }
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  return { sx, sy, sw, sh, dw: Math.max(1, Math.round(sw * scale)), dh: Math.max(1, Math.round(sh * scale)) };
}

