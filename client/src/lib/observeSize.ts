/**
 * Calls `onResize` when `el` changes size, at most once per animation frame, and only while it
 * has a real size. A map library needs this: it re-measures itself on a window resize, but a
 * collapsing sidebar or a dialog resizes its container without one.
 *
 * - A 0x0 (or one-sided zero) box is skipped: a hidden container has nothing to measure.
 * - Where `ResizeObserver` does not exist, nothing happens and the returned cleanup is a no-op.
 * - The returned cleanup disconnects the observer and drops a frame that has not run yet.
 */
export function observeSize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === "undefined") return () => {};

  let frame = 0;
  const observer = new ResizeObserver((entries) => {
    const size = entries[entries.length - 1]?.contentRect;
    if (!size || size.width === 0 || size.height === 0) return;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      onResize();
    });
  });
  observer.observe(el);

  return () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };
}
