/** Sets or clears (`null`) one param, keeping the others that other controls own. */
export function withParam(params: URLSearchParams, name: string, value: string | null): URLSearchParams {
  const next = new URLSearchParams(params);
  if (value == null) next.delete(name);
  else next.set(name, value);
  return next;
}

/** For `<Link to={{ search }}>`; empty when nothing is left. */
export function searchWith(params: URLSearchParams, name: string, value: string | null): string {
  const next = withParam(params, name, value).toString();
  return next === "" ? "" : `?${next}`;
}
