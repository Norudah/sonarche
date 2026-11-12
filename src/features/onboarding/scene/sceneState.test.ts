import { describe, expect, it } from "vitest";

import { sceneState } from "@/features/onboarding/scene/sceneState";

const base = { screen: "engine", engine: "idle", cargo: 0, key: "intro", entering: false } as const;

describe("sceneState", () => {
  it("waits on the dock, empty, before the install", () => {
    expect(sceneState(base)).toMatchObject({ afloat: false, cargo: 0, onde: "rest", caption: "waiting" });
  });

  it("loads crates while the engine installs", () => {
    expect(sceneState({ ...base, engine: "installing", cargo: 2 })).toMatchObject({
      afloat: false,
      cargo: 2,
      onde: "work",
      caption: "loading",
      busy: true,
    });
  });

  it("floats with every crate aboard once the engine is in", () => {
    expect(sceneState({ ...base, engine: "done", cargo: 4 })).toMatchObject({ afloat: true, cargo: 4, onde: "live" });
  });

  it("leaves a crate on the quay after a failed install", () => {
    expect(sceneState({ ...base, engine: "error", cargo: 2 })).toMatchObject({
      afloat: false,
      cargo: 2,
      stranded: true,
      label: "interrupted",
    });
  });

  it("keeps an empty dock on the Python screen", () => {
    expect(sceneState({ ...base, screen: "python", engine: "installing", cargo: 3 })).toMatchObject({
      afloat: false,
      cargo: 0,
    });
  });

  it("listens slowly while the key is being fetched, and fast while it is checked", () => {
    const onKey = { ...base, screen: "acoustid", engine: "done", cargo: 4 } as const;
    expect(sceneState({ ...onKey, key: "intro" }).rings).toBe("none");
    expect(sceneState({ ...onKey, key: "steps" }).rings).toBe("slow");
    expect(sceneState({ ...onKey, key: "verifying" })).toMatchObject({ rings: "fast", busy: true });
  });

  it("tells a key saved just now from one saved long ago", () => {
    const onKey = { ...base, screen: "acoustid", engine: "done" } as const;
    expect(sceneState({ ...onKey, key: "verified" }).caption).toBe("listening");
    expect(sceneState({ ...onKey, key: "saved" }).caption).toBe("stillListening");
  });

  it("puts the ark at sea for the entrance, whatever came before", () => {
    expect(sceneState({ ...base, entering: true })).toMatchObject({ afloat: true, cargo: 4, rings: "slow" });
  });
});
