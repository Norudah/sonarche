import { describe, expect, it } from "vitest";

import { DETAIL_KEY } from "@/features/import/PhaseDetail";

/**
 * `AnimatePresence mode="wait"` plays a key change as collapse-then-expand.
 * That is right when the content really swaps and absurd when it does not:
 * pressing Import used to fold the whole panel shut and reopen it on the same
 * summary. These pairs must keep sharing a key.
 */
describe("detail keys", () => {
  it("keeps the card open across a phase that shows the same thing", () => {
    expect(DETAIL_KEY.scanned).toBe(DETAIL_KEY.importing);
    expect(DETAIL_KEY.imported).toBe(DETAIL_KEY.importCancelled);
    expect(DETAIL_KEY.scanFailed).toBe(DETAIL_KEY.importFailed);
  });

  /** And still animates the swaps that are real: a recap is not a summary. */
  it("swaps when the content genuinely changes", () => {
    expect(DETAIL_KEY.importing).not.toBe(DETAIL_KEY.imported);
    expect(DETAIL_KEY.scanned).not.toBe(DETAIL_KEY.scanFailed);
  });
});
