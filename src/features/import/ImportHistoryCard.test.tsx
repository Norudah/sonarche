// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ImportRecord } from "@/features/import/api";
import { ImportHistoryCard } from "@/features/import/ImportHistoryCard";

afterEach(cleanup);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: "fr" } }),
}));

vi.mock("@/features/library/categories/useCategoryLabel", () => ({
  useCategoryLabel: () => (value: string) => value,
}));

// The action pulls in TanStack Query and the Tauri bridge; the card's contract
// here is whether it offers the way out at all.
vi.mock("@/features/import/ImportUndoAction", () => ({
  ImportUndoAction: () => <button type="button">undo.action</button>,
}));

const record = (over: Partial<ImportRecord> = {}): ImportRecord => ({
  id: "run-1",
  folder: "/Volumes/Backup/Musique",
  status: "done",
  error: null,
  scan: { playable: 40, unplayable: 0, unplayableByExtension: {}, bytes: 1000, albumFolders: 4 },
  folders: 4,
  renditions: 0,
  recap: null,
  finishedAt: 1_700_000_000_000,
  ...over,
});

/**
 * A run that was taken back out has to *read* as one. It brought tracks in, and
 * the row that says so unchanged would send someone looking for music that is
 * no longer there.
 */
describe("ImportHistoryCard, once an import has been undone", () => {
  const open = () => fireEvent.click(screen.getByRole("button", { name: "recap.expand" }));

  it("offers the way out on a run that still stands", () => {
    render(<ImportHistoryCard record={record()} />);
    open();
    expect(screen.queryByText("undo.action")).not.toBeNull();
    expect(screen.queryByText("verdict.done")).not.toBeNull();
  });

  it("says it was taken out, and stops offering to do it again", () => {
    render(<ImportHistoryCard record={record({ undoneAt: 1_700_000_100_000 })} />);
    open();
    expect(screen.queryByText("undo.verdict")).not.toBeNull();
    expect(screen.queryByText("verdict.done")).toBeNull();
    expect(screen.queryByText("undo.action")).toBeNull();
  });
});
