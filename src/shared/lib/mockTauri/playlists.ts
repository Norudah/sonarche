/** Playlists, mutated in place like the Rust store. */

import type { Handler } from "./types";
import { isEmpty, now, thumb } from "./fixtures";

/**
 * Mutated in place like the Rust store. Favorites always exists; the user
 * lists cover a long mixed list, a single-album list and a dead item id.
 */
interface MockPlaylist {
  id: number;
  name: string;
  kind: "user" | "favorites";
  cover_path: string | null;
  marker: string | null;
  created_at: number;
  updated_at: number;
  item_ids: number[];
}

const mockPlaylists: MockPlaylist[] = [
  {
    id: 100,
    name: "Favorites",
    kind: "favorites",
    cover_path: null,
    marker: null,
    created_at: now - 86_400_000 * 30,
    updated_at: now - 86_400_000,
    item_ids: isEmpty ? [] : [104, 112],
  },
  ...(isEmpty
    ? []
    : ([
        {
          id: 1,
          name: "Sessions de nuit",
          kind: "user",
          cover_path: null,
          // One of each sidebar face: icon, colour, default.
          marker: "icon:moon",
          created_at: now - 86_400_000 * 9,
          updated_at: now - 3_600_000,
          item_ids: [110, 106, 112, 116, 100, 2, 118],
        },
        {
          id: 2,
          name: "French touch",
          kind: "user",
          cover_path: null,
          marker: "color:rose",
          created_at: now - 86_400_000 * 4,
          updated_at: now - 86_400_000,
          item_ids: [103, 104, 105],
        },
        {
          id: 4,
          name: "Sport",
          kind: "user",
          cover_path: thumb("#f97316", "#7c2d12"),
          marker: "cover",
          created_at: now - 86_400_000 * 6,
          updated_at: now - 5_400_000,
          item_ids: [107, 108],
        },
        {
          id: 3,
          name: "Rétro console",
          kind: "user",
          cover_path: null,
          marker: null,
          created_at: now - 86_400_000 * 2,
          updated_at: now - 7_200_000,
          item_ids: [200, 201, 9999, 203],
        },
      ] as MockPlaylist[])),
];

let nextPlaylistId = 5;

function mockPlaylist(id: unknown): MockPlaylist {
  const playlist = mockPlaylists.find((row) => row.id === Number(id));
  if (!playlist) throw "invalid input: playlist not found";
  return playlist;
}

export const handlers: Record<string, Handler> = {
  list_playlists: () => ({ playlists: mockPlaylists.map((row) => ({ ...row })) }),
  create_playlist: (payload) => {
    const name = String(payload?.name ?? "").trim();
    if (name === "") throw "invalid input: empty playlist name";
    if (mockPlaylists.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
      throw "invalid input: a playlist with this name already exists";
    }
    const row: MockPlaylist = {
      id: nextPlaylistId++,
      name,
      kind: "user",
      cover_path: null,
      marker: null,
      created_at: Date.now(),
      updated_at: Date.now(),
      item_ids: [],
    };
    mockPlaylists.push(row);
    mockPlaylists.sort((a, b) => a.name.localeCompare(b.name));
    return { playlist: { ...row } };
  },
  rename_playlist: (payload) => {
    const row = mockPlaylist(payload?.id);
    if (row.kind === "favorites") throw "invalid input: the favorites playlist cannot be renamed";
    row.name = String(payload?.name ?? "").trim();
    mockPlaylists.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true };
  },
  delete_playlist: (payload) => {
    if (mockPlaylist(payload?.id).kind === "favorites") {
      throw "invalid input: the favorites playlist cannot be deleted";
    }
    const index = mockPlaylists.findIndex((row) => row.id === Number(payload?.id));
    if (index >= 0) mockPlaylists.splice(index, 1);
    return { ok: true };
  },
  set_playlist_cover: async (payload) => {
    const row = mockPlaylist(payload?.id);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    row.cover_path = thumb("#0ea5e9", "#164e63");
    row.updated_at = Date.now();
    return { id: row.id, filename: "mock.jpg" };
  },
  set_playlist_marker: (payload) => {
    const row = mockPlaylist(payload?.id);
    row.marker = String(payload?.marker ?? "") || null;
    row.updated_at = Date.now();
    return { ok: true };
  },
  remove_playlist_cover: (payload) => {
    const row = mockPlaylist(payload?.id);
    const had = row.cover_path != null;
    row.cover_path = null;
    return { removed: had };
  },
  add_playlist_tracks: (payload) => {
    const row = mockPlaylist(payload?.id);
    const present = new Set(row.item_ids);
    const incoming = (payload?.itemIds as number[]) ?? [];
    const fresh = incoming.filter((id) => !present.has(id) && present.add(id));
    row.item_ids.push(...fresh);
    row.updated_at = Date.now();
    return { added: fresh.length, skipped: incoming.length - fresh.length };
  },
  remove_playlist_tracks: (payload) => {
    const row = mockPlaylist(payload?.id);
    const doomed = new Set((payload?.positions as number[]) ?? []);
    const before = row.item_ids.length;
    row.item_ids = row.item_ids.filter((_, position) => !doomed.has(position));
    row.updated_at = Date.now();
    return { removed: before - row.item_ids.length };
  },
  move_playlist_track: (payload) => {
    const row = mockPlaylist(payload?.id);
    const [moved] = row.item_ids.splice(Number(payload?.from), 1);
    if (moved != null) row.item_ids.splice(Number(payload?.to), 0, moved);
    row.updated_at = Date.now();
    return { ok: true };
  },
};
