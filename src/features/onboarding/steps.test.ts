import { describe, expect, it } from "vitest";

import type { EnvStatus } from "@/features/onboarding/api";
import { buildSetupSteps, canFinishSetup, gateState, type SetupStepId } from "@/features/onboarding/steps";

const healthy: EnvStatus = {
  python: { path: "/opt/homebrew/bin/python3", version: "3.13.1" },
  venvOk: true,
  depsOk: true,
  libraryDir: "/music/Sonarche",
};

const env = (over: Partial<EnvStatus> = {}): EnvStatus => ({ ...healthy, ...over });

const stateOf = (steps: ReturnType<typeof buildSetupSteps>, id: SetupStepId) =>
  steps.find((step) => step.id === id)?.state;

describe("buildSetupSteps", () => {
  it("marks a healthy environment's blocking steps satisfied", () => {
    const steps = buildSetupSteps({ env: env(), acoustidConfigured: false });
    expect(stateOf(steps, "python")).toBe("satisfied");
    expect(stateOf(steps, "engine")).toBe("satisfied");
  });

  it("holds the steps behind a missing Python", () => {
    // No interpreter means no venv either — a venv whose base Python vanished
    // fails `depsOk`, so the backend never reports this pair any other way.
    const steps = buildSetupSteps({
      env: env({ python: null, venvOk: false, depsOk: false }),
      acoustidConfigured: true,
    });
    expect(stateOf(steps, "python")).toBe("actionRequired");
    expect(stateOf(steps, "engine")).toBe("pending");
    // Satisfied stays satisfied even behind a blocked step: the key is stored,
    // saying otherwise would ask the user to enter it again.
    expect(stateOf(steps, "acoustid")).toBe("satisfied");
  });

  it("treats a venv without its dependencies as an open engine step", () => {
    const steps = buildSetupSteps({ env: env({ depsOk: false }), acoustidConfigured: false });
    expect(stateOf(steps, "engine")).toBe("actionRequired");
    expect(stateOf(steps, "acoustid")).toBe("pending");
  });

  it("opens the optional step once the blocking ones are done", () => {
    const steps = buildSetupSteps({ env: env(), acoustidConfigured: false });
    expect(stateOf(steps, "acoustid")).toBe("actionRequired");
  });

  it("reports a passed-over optional step as skipped, not as open", () => {
    const steps = buildSetupSteps({ env: env(), acoustidConfigured: false, skipped: ["acoustid"] });
    expect(stateOf(steps, "acoustid")).toBe("skipped");
  });

  it("knows nothing before the environment answers", () => {
    const steps = buildSetupSteps({ env: null, acoustidConfigured: true });
    expect(stateOf(steps, "python")).toBe("actionRequired");
    expect(stateOf(steps, "engine")).toBe("pending");
  });
});

describe("canFinishSetup", () => {
  it("ignores optional steps", () => {
    expect(canFinishSetup(buildSetupSteps({ env: env(), acoustidConfigured: false }))).toBe(true);
  });

  it("refuses while a blocking step is open", () => {
    expect(canFinishSetup(buildSetupSteps({ env: env({ venvOk: false }), acoustidConfigured: true }))).toBe(false);
  });
});

describe("gateState", () => {
  const steps = (input: Parameters<typeof buildSetupSteps>[0]) => buildSetupSteps(input);

  it("waits before the environment is known", () => {
    expect(
      gateState({
        steps: steps({ env: null, acoustidConfigured: false }),
        envKnown: false,
        onboardingCompleted: true,
      }),
    ).toBe("checking");
  });

  it("holds the window on a broken environment even once onboarded", () => {
    expect(
      gateState({
        steps: steps({ env: env({ python: null }), acoustidConfigured: true }),
        envKnown: true,
        onboardingCompleted: true,
      }),
    ).toBe("onboarding");
  });

  it("still walks a healthy but never-onboarded install through", () => {
    expect(
      gateState({
        steps: steps({ env: env(), acoustidConfigured: true }),
        envKnown: true,
        onboardingCompleted: false,
      }),
    ).toBe("onboarding");
  });

  it("opens the app once onboarded, key or no key", () => {
    expect(
      gateState({
        steps: steps({ env: env(), acoustidConfigured: false }),
        envKnown: true,
        onboardingCompleted: true,
      }),
    ).toBe("ready");
  });
});
