/**
 * Desktop sidebar collapse: the one remembered preference. Storage can be missing, blocked or
 * full (private window, cleared site data, a WebView), so every access is guarded and the
 * fallback is the expanded sidebar, which is always correct.
 */
export const SIDEBAR_STORAGE_KEY = "puntakit.sidebar.collapsed";
export const SIDEBAR_EXPANDED_WIDTH_REM = 15;
export const SIDEBAR_COLLAPSED_WIDTH_REM = 4.5;

/** `window.localStorage`, or undefined where even reading the property throws. */
export function getBrowserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readStoredCollapsed(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeStoredCollapsed(storage: Pick<Storage, "setItem"> | undefined, collapsed: boolean): void {
  try {
    storage?.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    /* the preference just does not persist */
  }
}
