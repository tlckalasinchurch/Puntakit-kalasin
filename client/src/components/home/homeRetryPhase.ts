/**
 * The life of one "try again" on Home, as a pure function so it can be tested without a DOM.
 *
 * Why it exists: pressing retry used to remove the retry button the moment the query went back to
 * "loading", so keyboard focus fell to <body>. The retry area now stays mounted while the retry is
 * in flight (`waiting` -> `loading`) and, if the retry worked and focus was still inside the area,
 * hands focus to a short "recovered" note (`recovered`) instead of dropping it.
 */
export type RetryPhase = "idle" | "waiting" | "loading" | "recovered";

/** Retry was pressed, but the query has not reported "loading" yet. */
export const WAITING: RetryPhase = "waiting";

export interface RetryObservation {
  /** Any query being retried is still in flight. */
  loading: boolean;
  /** How many queries are currently failed. */
  failed: number;
}

/** The retry area (button or note) must stay on screen while this is true. */
export function isBusy(phase: RetryPhase): boolean {
  return phase === "waiting" || phase === "loading";
}

/**
 * `focusInside`: focus is still within the retry area right now. It is only read when a retry
 * settles successfully, so focus is moved only if the user has not gone elsewhere meanwhile.
 */
export function nextPhase(phase: RetryPhase, now: RetryObservation, focusInside: boolean): RetryPhase {
  switch (phase) {
    case "waiting":
      // The query is still showing its old "failed" state until it flips to loading; settling on
      // that would read as "failed again" before the retry has even started.
      return now.loading ? "loading" : "waiting";
    case "loading":
      if (now.loading) return "loading";
      if (now.failed > 0) return "idle";
      return focusInside ? "recovered" : "idle";
    case "recovered":
      return now.loading || now.failed > 0 ? "idle" : "recovered";
    default:
      return "idle";
  }
}
