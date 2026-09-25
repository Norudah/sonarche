import { withParam } from "@/features/library/queryParams";

/** A query param (a route segment would remount the page), not remembered
 * across subjects. */
export const VIEW_MODES = ["overview", "tracks"] as const;
export type ViewMode = (typeof VIEW_MODES)[number];

/** Unknown values mean overview. */
export function parseViewMode(params: URLSearchParams): ViewMode {
  return params.get("view") === "tracks" ? "tracks" : "overview";
}

/** Swaps the mode, keeping other params; overview is the absence of the param. */
export function withViewMode(params: URLSearchParams, mode: ViewMode): URLSearchParams {
  return withParam(params, "view", mode === "overview" ? null : mode);
}
