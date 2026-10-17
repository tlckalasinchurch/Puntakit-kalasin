import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { isBusy, nextPhase, WAITING, type RetryObservation, type RetryPhase } from "./homeRetryPhase";

interface Settled {
  failed: number;
  focusInside: boolean;
  /** The retry area itself, so a caller can look for something outside it. */
  root: HTMLElement | null;
}

/**
 * Keeps a retry area mounted while its retry is in flight and decides what happens to focus when it
 * ends (see homeRetryPhase.ts). Attach `rootRef` to the element that holds the retry button and the
 * recovered note, and give the note `messageRef`, `tabIndex={-1}` and `onBlur={dismiss}`.
 *
 * The recovered note takes focus, which makes a screen reader read it; there is deliberately no
 * live region for it, so the success is announced once.
 */
export function useRetryZone(now: RetryObservation, onSettled?: (settled: Settled) => void) {
  const rootRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLParagraphElement>(null);
  const [phase, setPhase] = useState<RetryPhase>("idle");
  const phaseRef = useRef<RetryPhase>("idle");
  const onSettledRef = useRef(onSettled);
  onSettledRef.current = onSettled;

  /** False when a retry is already running: a second press in the same tick must not fire again. */
  const begin = useCallback(() => {
    if (phaseRef.current !== "idle") return false;
    phaseRef.current = WAITING;
    setPhase(WAITING);
    return true;
  }, []);

  const dismiss = useCallback(() => {
    phaseRef.current = "idle";
    setPhase("idle");
  }, []);

  // Layout effect: the decision must be made while the retry button is still in the DOM, and the
  // swap must happen before paint so a finished retry never flashes the old error.
  useLayoutEffect(() => {
    const prev = phaseRef.current;
    const focusInside = rootRef.current?.contains(document.activeElement) ?? false;
    const next = nextPhase(prev, now, focusInside);
    if (next === prev) return;
    phaseRef.current = next;
    setPhase(next);
    if (prev === "loading") onSettledRef.current?.({ failed: now.failed, focusInside, root: rootRef.current });
  }, [now.loading, now.failed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase === "recovered") messageRef.current?.focus();
  }, [phase]);

  return { phase, busy: isBusy(phase), recovered: phase === "recovered", rootRef, messageRef, begin, dismiss };
}
