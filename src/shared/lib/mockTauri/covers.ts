/** Covers, artist images, the file picker and the clipboard. */

import type { Handler } from "./types";
import { thumb } from "./fixtures";
import { library } from "./library";
import { MOCK_IMPORT_FOLDER } from "./imports";

/** Starts empty: the generated avatar is the default. */
const artistImages = new Map<string, string>();

export const handlers: Record<string, Handler> = {
  // Folder requests get the import folder; file requests a cover image.
  "plugin:dialog|open": (payload) => {
    const options = payload?.options as { directory?: boolean } | undefined;
    return options?.directory ? MOCK_IMPORT_FOLDER : "/Users/dev/Pictures/discovery-scan.jpg";
  },
  // Landscape, so the reframe slider is exercised.
  allow_cover_preview: () => {
    return { path: thumb("#0ea5e9", "#164e63"), bytes: 4_600_000 };
  },
  album_recrop_source: () => {
    return { path: thumb("#f472b6", "#7c3aed"), bytes: 3_100_000 };
  },
  // `?nocandidates` / `?candidatesfail` preview the empty and error states.
  list_cover_candidates: async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    const search = new URLSearchParams(window.location.search);
    if (search.has("candidatesfail")) throw new Error("caa unreachable");
    if (search.has("nocandidates")) return { candidates: [] };
    return {
      candidates: [
        {
          id: "caa-1",
          thumb: thumb("#7c3aed", "#312e81"),
          image_url: "https://coverartarchive.org/release/mock/1.jpg",
          front: true,
          types: ["Front"],
        },
        {
          id: "caa-2",
          thumb: thumb("#0d9488", "#134e4a"),
          image_url: "https://coverartarchive.org/release/mock/2.jpg",
          front: false,
          types: ["Back"],
        },
        {
          id: "caa-3",
          thumb: thumb("#b45309", "#78350f"),
          image_url: "https://coverartarchive.org/release/mock/3.jpg",
          front: false,
          types: ["Medium"],
        },
      ],
    };
  },
  set_album_cover: async (payload) => {
    const albumId = Number(payload?.albumId);
    const { tracks } = library as { tracks: { album_id: number }[] };
    const fresh = thumb("#0ea5e9", "#164e63");
    let embedded = 0;
    for (const track of tracks as unknown as {
      album_id: number;
      art_path: string | null;
      provisional_cover?: boolean;
    }[]) {
      if (track.album_id !== albumId) continue;
      track.art_path = fresh;
      track.provisional_cover = false;
      embedded += 1;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    return { art_path: fresh, side: 180, embedded };
  },
  list_artist_images: () => {
    return {
      images: [...artistImages].map(([name, path]) => ({ name, path, updated_at: 0 })),
    };
  },
  set_artist_image: async (payload) => {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    artistImages.set(String(payload?.name), thumb("#7c3aed", "#312e81"));
    return { name: payload?.name, filename: "mock.jpg" };
  },
  remove_artist_image: (payload) => {
    return { removed: artistImages.delete(String(payload?.name)) };
  },
  fetch_artist_image_url: async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 600));
    if (new URLSearchParams(window.location.search).has("urlfail")) throw new Error("not an image");
    return { path: "/tmp/mock-fetched.jpg", bytes: 2_400_000 };
  },
  // No OS pasteboard: the image read fails and the text read returns a URL,
  // exercising the clipboard → link → adopt chain.
  "plugin:clipboard-manager|read_image": () => {
    throw new Error("no image on the mock clipboard");
  },
  "plugin:clipboard-manager|read_text": () => "https://example.com/mock-copied-cover.jpg",
  save_pasted_image: () => {
    return { path: "/tmp/mock-pasted.png", bytes: 1_000_000 };
  },
};
