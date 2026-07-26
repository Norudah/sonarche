/**
 * One query param changed, every other one carried through.
 *
 * The carrying-through is the whole point. Several controls on the same page each
 * own one param — the genre chips own `?genre=`, the view switcher `?view=`, the
 * filter bar its own axes — and a control that rebuilds the query from its own
 * value alone silently resets the others: flipping a sub-genre chip in the tracks
 * mode threw the page back to its overview, because the chip's URL never
 * mentioned the mode.
 *
 * `null` clears the param rather than writing an empty value, so a cleared filter
 * leaves no trace in the URL.
 */
export function withParam(params: URLSearchParams, name: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value == null) next.delete(name);
  else next.set(name, value);
  return next;
}

/** The same change, ready for a `<Link to={{ search }}>` — empty when nothing is
 * left, which is what clears the query instead of leaving a bare "?". */
export function searchWith(params: URLSearchParams, name: string, value: string | null): string {
  const next = withParam(params, name, value).toString();
  return next === "" ? "" : `?${next}`;
}
