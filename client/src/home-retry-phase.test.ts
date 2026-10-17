import { describe, expect, it } from "vitest";
import { WAITING, isBusy, nextPhase, type RetryPhase } from "./components/home/homeRetryPhase";

const loading = { loading: true, failed: 0 };
const failed = (n: number) => ({ loading: false, failed: n });
const ok = { loading: false, failed: 0 };

describe("retry phase: what happens to focus when a retry ends", () => {
  it("the retry area counts as busy from the press until the retry ends", () => {
    expect(isBusy(WAITING)).toBe(true);
    expect(isBusy("loading")).toBe(true);
    expect(isBusy("idle")).toBe(false);
    expect(isBusy("recovered")).toBe(false);
  });

  it("does not settle on the old failure before the retry has started", () => {
    // right after the press the query still reports 'failed'; that is not 'failed again'
    expect(nextPhase(WAITING, failed(2), true)).toBe("waiting");
    expect(nextPhase(WAITING, loading, true)).toBe("loading");
  });

  it("stays loading while anything is in flight", () => {
    expect(nextPhase("loading", loading, true)).toBe("loading");
    expect(nextPhase("loading", { loading: true, failed: 1 }, true)).toBe("loading");
  });

  it("a retry that works hands focus to the recovered note only if focus is still in the area", () => {
    expect(nextPhase("loading", ok, true)).toBe("recovered");
    // the user moved on: no note, no focus change
    expect(nextPhase("loading", ok, false)).toBe("idle");
  });

  it("a retry that fails again leaves the area (and the focused button) as it was", () => {
    expect(nextPhase("loading", failed(1), true)).toBe("idle");
    expect(nextPhase("loading", failed(3), false)).toBe("idle");
  });

  it("the note stays until it is dismissed, unless a new load starts or something fails", () => {
    expect(nextPhase("recovered", ok, true)).toBe("recovered");
    expect(nextPhase("recovered", loading, true)).toBe("idle");
    expect(nextPhase("recovered", failed(1), true)).toBe("idle");
  });

  it("idle is stable whatever the queries do", () => {
    const phases: RetryPhase[] = [];
    for (const now of [ok, loading, failed(1), failed(4)]) phases.push(nextPhase("idle", now, true));
    expect(new Set(phases)).toEqual(new Set(["idle"]));
  });
});
