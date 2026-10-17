import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SIDEBAR_COLLAPSED_WIDTH_REM,
  SIDEBAR_EXPANDED_WIDTH_REM,
  SIDEBAR_STORAGE_KEY,
  getBrowserStorage,
  readStoredCollapsed,
  writeStoredCollapsed,
} from "./sidebarState";

afterEach(() => vi.unstubAllGlobals());

describe("readStoredCollapsed", () => {
  it("is true only for the stored value \"1\"", () => {
    expect(readStoredCollapsed({ getItem: () => "1" })).toBe(true);
    expect(readStoredCollapsed({ getItem: () => "0" })).toBe(false);
    expect(readStoredCollapsed({ getItem: () => null })).toBe(false);
  });

  it("falls back to expanded for a corrupt value", () => {
    for (const junk of ["banana", "", "true", "{}", "1 "]) {
      expect(readStoredCollapsed({ getItem: () => junk }), junk).toBe(false);
    }
  });

  it("falls back to expanded when storage is missing or throws (private window, blocked site data)", () => {
    expect(readStoredCollapsed(undefined)).toBe(false);
    expect(
      readStoredCollapsed({
        getItem: () => {
          throw new Error("SecurityError");
        },
      })
    ).toBe(false);
  });

  it("reads the documented key", () => {
    const getItem = vi.fn(() => "1");
    readStoredCollapsed({ getItem });
    expect(getItem).toHaveBeenCalledWith(SIDEBAR_STORAGE_KEY);
    expect(SIDEBAR_STORAGE_KEY).toBe("puntakit.sidebar.collapsed");
  });
});

describe("writeStoredCollapsed", () => {
  it("stores \"1\" for collapsed and \"0\" for expanded", () => {
    const setItem = vi.fn();
    writeStoredCollapsed({ setItem }, true);
    writeStoredCollapsed({ setItem }, false);
    expect(setItem).toHaveBeenNthCalledWith(1, SIDEBAR_STORAGE_KEY, "1");
    expect(setItem).toHaveBeenNthCalledWith(2, SIDEBAR_STORAGE_KEY, "0");
  });

  it("never throws when storage is missing or full", () => {
    expect(() => writeStoredCollapsed(undefined, true)).not.toThrow();
    expect(() =>
      writeStoredCollapsed(
        {
          setItem: () => {
            throw new Error("QuotaExceededError");
          },
        },
        true
      )
    ).not.toThrow();
  });
});

describe("getBrowserStorage", () => {
  it("returns undefined when there is no window (server render, tests)", () => {
    vi.stubGlobal("window", undefined);
    expect(getBrowserStorage()).toBeUndefined();
  });

  it("returns undefined when merely touching window.localStorage throws", () => {
    vi.stubGlobal("window", {
      get localStorage(): Storage {
        throw new Error("SecurityError");
      },
    });
    expect(getBrowserStorage()).toBeUndefined();
  });
});

describe("rail widths", () => {
  it("the collapsed rail is narrower than the expanded sidebar", () => {
    expect(SIDEBAR_COLLAPSED_WIDTH_REM).toBeLessThan(SIDEBAR_EXPANDED_WIDTH_REM);
    expect(SIDEBAR_EXPANDED_WIDTH_REM).toBe(15);
    expect(SIDEBAR_COLLAPSED_WIDTH_REM).toBe(4.5);
  });
});
