/**
 * Dev-only: force the walkthrough open without destroying anything.
 *
 * The reset in Settings › Développeur is the honest way to replay a step, but
 * it costs a `pip install` to undo. Iterating on the walkthrough's *design*
 * needs neither — `?onboarding=1` simply makes the gate ignore the completion
 * flag, so the flow can be opened and closed as many times as it takes.
 *
 * Stripped from production builds: `import.meta.env.DEV` is a literal at build
 * time, so the whole body folds away.
 */
export function onboardingForcedByDev(): boolean {
  // `typeof window` guard: this module is reachable from node-env unit tests.
  if (!import.meta.env.DEV || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("onboarding") === "1";
}
