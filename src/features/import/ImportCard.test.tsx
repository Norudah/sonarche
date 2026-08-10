// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ScanReport } from "@/features/import/api";
import { ImportCard } from "@/features/import/ImportCard";

afterEach(cleanup);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));

const report: ScanReport = {
  playable: 10,
  unplayable: 0,
  unplayableByExtension: {},
  unplayableExamples: [],
  albumFolders: 4,
  largestFolder: 0,
  bytes: 100,
  truncated: false,
};

/**
 * The stop button's contract: offered exactly while a stop can still stop
 * something. The watchdog only guards beets — once the cover pass starts, a
 * stop would be a no-op, and a button that does nothing is worse than none.
 */
describe("ImportCard stop button", () => {
  const card = (progress: Parameters<typeof ImportCard>[0]["progress"], onCancel = () => {}) => (
    <ImportCard
      folder="/Music/Rips"
      phase={{ kind: "importing", report }}
      progress={progress}
      onCancel={onCancel}
      isCancelling={false}
    />
  );

  it("offers the stop while the copy runs, and wires it", () => {
    const onCancel = vi.fn();
    render(card({ stage: "copying", folders: 1, folder: "/Music/Rips/A" }, onCancel));

    fireEvent.click(screen.getByRole("button", { name: /stop/ }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("offers it before the first progress tick, when beets is already working", () => {
    render(card(null));
    expect(screen.queryByRole("button", { name: /stop/ })).not.toBeNull();
  });

  it("withdraws it during the cover pass, which a stop cannot stop", () => {
    render(card({ stage: "covers", done: 1, total: 4 }));
    expect(screen.queryByRole("button", { name: /stop/ })).toBeNull();
  });

  it("shows the stopped verdict instead of a button once cancelled", () => {
    render(
      <ImportCard
        folder="/Music/Rips"
        phase={{
          kind: "importCancelled",
          outcome: { folders: 2, renditions: 0, recap: null, cancelled: true },
          report,
        }}
        progress={null}
        onCancel={() => {}}
        isCancelling={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /stop/ })).toBeNull();
    expect(screen.queryByText("verdict.cancelled")).not.toBeNull();
  });
});
