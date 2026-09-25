/** Dev-only: `?onboarding=1` ignores the completion flag, to iterate on the
 * walkthrough without resetting anything. Folded away in production. */
export function onboardingForcedByDev(): boolean {
  // Also reachable from node-env unit tests.
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("onboarding") === "1";
}
