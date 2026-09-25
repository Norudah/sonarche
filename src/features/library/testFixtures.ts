import type { LibraryTrack } from "@/features/library/api";

/** An empty library item; tests set only what they need. */
export function track(over: Partial<LibraryTrack> = {}): LibraryTrack {
  return {
    id: 1,
    title: "",
    artist: "",
    album: "",
    albumArtist: "",
    year: null,
    genre: null,
    genreBucket: null,
    track: null,
    trackTotal: null,
    length: null,
    bitrate: null,
    format: "AAC",
    path: "",
    audioUrl: "",
    albumId: 1,
    artUrl: null,
    artPath: null,
    bonusSource: null,
    mbTrackId: null,
    suspectMatch: false,
    provisionalCover: false,
    category: null,
    soundtrack: false,
    albumKind: null,
    accepted: [],
    albumAccepted: [],
    ...over,
  };
}
