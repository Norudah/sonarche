import { describe, expect, it } from "vitest";

import type { EnvStatus } from "@/features/onboarding/api";
import {
  canOpenScreen,
  initialScreen,
  nextScreen,
  previousScreen,
  screenPosition,
} from "@/features/onboarding/setupNavigation";
import { buildSetupSteps } from "@/features/onboarding/steps";

const healthy: EnvStatus = {
  python: { path: "/app/runtime/bin/python3", version: "3.13.1" },
  pythonBundled: true,
  venvOk: true,
  depsOk: true,
  libraryDir: "/music/Sonarche",
};

const steps = (env: Partial<EnvStatus> = {}, acoustidConfigured = false) =>
  buildSetupSteps({ env: { ...healthy, ...env }, acoustidConfigured });

const noEngine = { venvOk: false, depsOk: false };

describe("initialScreen", () => {
  it("opens on the engine of a fresh install", () => {
    expect(initialScreen(steps(noEngine))).toBe("engine");
  });

  it("opens on Python when it is missing and not bundled", () => {
    expect(initialScreen(steps({ ...noEngine, python: null, pythonBundled: false }))).toBe("python");
  });

  it("opens on the key once the engine is in place", () => {
    expect(initialScreen(steps())).toBe("acoustid");
  });

  // A repair: the engine broke, the key was saved long ago.
  it("opens on the engine of a broken install, whatever the key", () => {
    expect(initialScreen(steps(noEngine, true))).toBe("engine");
  });

  it("falls back to the last screen when nothing is asked", () => {
    expect(initialScreen(steps({}, true))).toBe("acoustid");
  });
});

describe("navigation", () => {
  it("has no way back from the first screen", () => {
    expect(previousScreen(steps(), "engine")).toBeNull();
    expect(previousScreen(steps(), "acoustid")).toBe("engine");
  });

  it("goes back through the Python screen when there is one", () => {
    const withPython = steps({ pythonBundled: false });
    expect(previousScreen(withPython, "engine")).toBe("python");
  });

  it("won't move past an engine that isn't installed", () => {
    expect(nextScreen(steps(noEngine), "engine")).toBeNull();
    expect(canOpenScreen(steps(noEngine), "acoustid")).toBe(false);
  });

  it("moves to the key once the engine is installed", () => {
    expect(nextScreen(steps(), "engine")).toBe("acoustid");
    expect(nextScreen(steps(), "acoustid")).toBeNull();
  });
});

describe("screenPosition", () => {
  it("counts two screens with a bundled interpreter", () => {
    expect(screenPosition(steps(), "acoustid")).toEqual({ n: 2, total: 2 });
  });

  it("counts three with the Python screen", () => {
    expect(screenPosition(steps({ pythonBundled: false }), "engine")).toEqual({ n: 2, total: 3 });
  });
});
