import { describe, expect, it } from "vitest";

import fr from "@/features/settings/locales/fr.json";
import { buildSettingsIndex, filterSettings } from "@/features/settings/settingsIndex";

/** The real bundle: the index is derived from the locale files' shape, so a
 * test against a fixture would only prove the fixture. */
const translate = (key: string): string =>
  key.split(".").reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], fr) as string;

const entries = buildSettingsIndex(fr, translate);

describe("buildSettingsIndex", () => {
  it("finds the settings a pane lists", () => {
    const keys = entries.map((entry) => entry.key);
    expect(keys).toContain("appearance.theme");
    expect(keys).toContain("adding.downloadOptions");
    expect(keys).toContain("files.audioFormat");
    expect(keys).toContain("services.acoustid");
    expect(keys).toContain("advanced.reinstall");
    expect(keys).toContain("danger.erase");
  });

  /** One level down live the three audio formats and the two fixed service
   * delays. They name themselves for other reasons and none of them is a
   * setting anyone goes looking for. */
  it("stops at the direct children of a category", () => {
    const keys = entries.map((entry) => entry.key);
    expect(keys).not.toContain("files.audioFormat.formats");
    expect(keys.some((key) => key.split(".").length > 2)).toBe(false);
  });

  /** `files.move` and `services.fixed` carry a `title`, not a `name`: they are
   * a dialog and an informational card, not settings. */
  it("ignores blocks that do not name themselves", () => {
    const keys = entries.map((entry) => entry.key);
    expect(keys).not.toContain("files.move");
    expect(keys).not.toContain("services.fixed");
    expect(keys).not.toContain("services.names");
  });

  it("carries the setting's own name and reason, under its pane", () => {
    const theme = entries.find((entry) => entry.key === "appearance.theme");
    expect(theme?.name).toBe("Thème");
    expect(theme?.why).toContain("Le thème clair");
    expect(theme?.category).toBe("appearance");
    expect(theme?.parentLabel).toBe("Apparence");
  });

  /** Some of what people search for is true of a whole pane and of no row in
   * it, so each pane is an entry too — named for itself, filed under its
   * group. */
  it("indexes the panes on their own lede", () => {
    const services = entries.find((entry) => entry.key === "services");
    expect(services?.name).toBe("Services externes");
    expect(services?.parentLabel).toBe("Ta bibliothèque");
    expect(services?.why).toContain("identifier ta musique");
  });

  it("survives a bundle that is not there", () => {
    expect(buildSettingsIndex(undefined, translate)).toEqual([]);
    expect(buildSettingsIndex("nonsense", translate)).toEqual([]);
  });
});

describe("filterSettings", () => {
  it("matches a setting by its name", () => {
    expect(filterSettings(entries, "thème").map((entry) => entry.key)).toContain("appearance.theme");
  });

  /** The whole point of indexing the reasons: nobody looking for the download
   * pause types "délai", they type the error they are getting. */
  it("matches on the reason, not only the name", () => {
    expect(filterSettings(entries, "403").map((entry) => entry.key)).toContain("adding.delay");
    expect(filterSettings(entries, "empreinte").map((entry) => entry.key)).toContain("services.acoustid");
  });

  it("ignores accents and case", () => {
    expect(filterSettings(entries, "THEME").map((entry) => entry.key)).toContain("appearance.theme");
  });

  it("requires every term to land", () => {
    expect(filterSettings(entries, "format hélicoptère")).toHaveLength(0);
  });

  /** A pane whose lede answers the query, when no single row does. */
  it("falls back to the pane when the answer is written at its head", () => {
    expect(filterSettings(entries, "trousseau").map((entry) => entry.key)).toEqual(["services"]);
  });
});
