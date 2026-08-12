// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MoveSpec } from "@/features/library/api";
import { track } from "@/features/library/testFixtures";

/**
 * The browser cannot hold the toast still long enough to click it, so the one
 * piece of glue no other test covers — the toast's Annuler firing the way back
 * — is pinned here: run a move, press the captured action, assert the inverse
 * calls.
 */

const { moveTracks, updateTracks, toast } = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { close: vi.fn() });
  return {
    moveTracks: vi
      .fn()
      .mockResolvedValue({ moved: 1, skipped: 0, created: false, targetAlbumId: 7, sourcesRemoved: 0 }),
    updateTracks: vi.fn().mockResolvedValue({ updated: 1 }),
    toast,
  };
});

vi.mock("@/features/library/api", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  moveTracks,
  updateTracks,
}));

vi.mock("@heroui/react", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  toast,
}));

import { useMoveWithUndo } from "@/features/library/albums/useMoveWithUndo";
import { libraryKey } from "@/features/library/hooks";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // The shelf as it stands after the move: the source record survived, so the
  // way back must aim at its row rather than recreate a twin.
  queryClient.setQueryData(libraryKey, [track({ id: 1, album: "Kid A", albumArtist: "Radiohead", albumId: 3 })]);

  let api: ReturnType<typeof useMoveWithUndo>;
  function Probe() {
    api = useMoveWithUndo();
    return null;
  }
  render(
    <QueryClientProvider client={queryClient}>
      <Probe />
    </QueryClientProvider>,
  );
  return { run: (...args: Parameters<typeof api.run>) => api.run(...args) };
}

describe("useMoveWithUndo", () => {
  it("announces the move with a way back, and the way back is the inverse call", async () => {
    const { run } = setup();
    const spec: MoveSpec = { itemIds: [10], targetAlbumId: 7, kind: "collection", renumber: true };
    const snapshot = [
      track({ id: 10, album: "Kid A", albumArtist: "Radiohead", albumId: 3, track: 4, trackTotal: 10 }),
    ];

    act(() => run(spec, snapshot, "Mine"));

    // First argument only: react-query hands the mutationFn its own context
    // alongside the variables.
    await waitFor(() => expect(moveTracks.mock.calls[0]?.[0]).toEqual(spec));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    const [, options] = toast.mock.calls[0];
    expect(options.actionProps).toBeDefined();

    await act(async () => {
      options.actionProps.onPress();
    });

    // The inverse: same verb aimed at the surviving source row, then the old
    // numbering restored through the ordinary update path.
    await waitFor(() => expect(moveTracks.mock.calls[1]?.[0]).toEqual({ itemIds: [10], targetAlbumId: 3 }));
    await waitFor(() =>
      expect(updateTracks.mock.calls[0]?.[0]).toEqual([{ id: 10, fields: { track: "4", tracktotal: "10" } }]),
    );
  });

  it("a second press does not undo twice", async () => {
    const { run } = setup();
    const snapshot = [track({ id: 10, album: "Kid A", albumArtist: "Radiohead", albumId: 3 })];

    act(() => run({ itemIds: [10], targetAlbumId: 7 }, snapshot, "Mine"));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    const [, options] = toast.mock.calls[0];

    await act(async () => {
      options.actionProps.onPress();
      options.actionProps.onPress();
    });

    // One for the move, one for the undo — not two undos.
    await waitFor(() => expect(moveTracks).toHaveBeenCalledTimes(2));
  });

  it("offers no way back when a track had no record to return to", async () => {
    const { run } = setup();
    const snapshot = [track({ id: 10, album: "" })];

    act(() => run({ itemIds: [10], targetAlbumId: 7 }, snapshot, "Mine"));

    await waitFor(() => expect(toast).toHaveBeenCalled());
    // The move is still announced — it just carries no button to take it back.
    expect(toast.mock.calls[0][1]?.actionProps).toBeUndefined();
  });
});
