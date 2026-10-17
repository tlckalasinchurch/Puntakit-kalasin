/**
 * The one rule behind Home's error display, kept free of React and path aliases so it can be tested
 * on its own. See homeFailures.tsx for how it is used.
 */

/** Distinct failing queries at which Home shows one banner instead of a box per section. */
export const PAGE_WIDE_FAILURES = 2;

/**
 * True when enough different queries have failed that the page, not one section, is unwell.
 * Counts distinct query keys: one query (e.g. the summary) can feed several sections, and its
 * failure is still one failure.
 */
export function isPageWideFailure(failedKeys: readonly string[]): boolean {
  return new Set(failedKeys).size >= PAGE_WIDE_FAILURES;
}
