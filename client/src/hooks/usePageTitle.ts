import { useEffect } from "react";

/**
 * Keeps the browser tab (and the screen-reader page context) in sync with the
 * route. The SPA previously shipped one static <title> for all 24 routes.
 *
 * The suffix is the brand, spelled the same way as index.html; restoring the
 * previous title on unmount keeps Back/Forward transitions consistent even
 * between pages that do not (yet) call this hook.
 */
export function usePageTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} · Puntakit Kalasin`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
