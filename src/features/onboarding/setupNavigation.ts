/** Which setup screen shows, and where "Back" leads. One screen per visible
 * step; the primary button moves forward, "Back" never undoes anything. */

import type { SetupStep, SetupStepId } from "@/features/onboarding/steps";

/** The first screen that asks for something; the last one if none does
 * (a healthy install walked through again). */
export function initialScreen(steps: readonly SetupStep[]): SetupStepId {
  const open = steps.find((step) => step.state === "actionRequired");
  return (open ?? steps[steps.length - 1]).id;
}

/** A screen behind an unfinished blocking step can't be opened. */
export function canOpenScreen(steps: readonly SetupStep[], id: SetupStepId): boolean {
  const step = steps.find((candidate) => candidate.id === id);
  return step !== undefined && step.state !== "pending";
}

export function previousScreen(steps: readonly SetupStep[], current: SetupStepId): SetupStepId | null {
  const index = steps.findIndex((step) => step.id === current);
  return index > 0 ? steps[index - 1].id : null;
}

export function nextScreen(steps: readonly SetupStep[], current: SetupStepId): SetupStepId | null {
  const index = steps.findIndex((step) => step.id === current);
  const next = index >= 0 ? steps[index + 1] : undefined;
  return next && next.state !== "pending" ? next.id : null;
}

/** "Step n of total", 1-based. */
export function screenPosition(steps: readonly SetupStep[], current: SetupStepId): { n: number; total: number } {
  return { n: steps.findIndex((step) => step.id === current) + 1, total: steps.length };
}
