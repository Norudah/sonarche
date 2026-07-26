import { withParam } from "@/features/library/queryParams";

/**
 * Which face a scoped page is showing: its index, or its tracks.
 *
 * A query param and not a route segment, for the reason the genre chips are one
 * too: React Router expands an optional segment into two route entries, so
 * flipping the switch would unmount the page and mount a fresh one — the hero
 * would restart its fade and every card would rebuild. A param keeps one match,
 * so only the body changes.
 *
 * It stays in the URL rather than in component state so the choice survives
 * opening an album and coming back. It is deliberately *not* remembered across
 * subjects: clicking a genre card and landing on a table because of a choice
 * made on some other page reads as the app losing your place.
 */
export const VIEW_MODES = ["overview", "tracks"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/** Anything unrecognised is the overview — the default a cold link lands on. */
export function parseViewMode(params: URLSearchParams): ViewMode {
  return params.get("view") === "tracks" ? "tracks" : "overview";
}

/**
 * The same URL with the mode swapped, every other param carried through — the
 * genre a page is refined on must survive the switch.
 *
 * The overview drops the param instead of writing `view=overview`: it is the
 * default, and a URL that says so is a URL that has to be kept in sync with the
 * default forever.
 */
export function withViewMode(params: URLSearchParams, mode: ViewMode): URLSearchParams {
  return withParam(params, "view", mode === "overview" ? null : mode);
}
