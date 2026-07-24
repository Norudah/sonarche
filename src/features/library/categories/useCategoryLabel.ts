import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/** i18n key per canonical taxonomy value. A value outside the map is a free
 * tag the user typed — shown as stored, there is nothing to translate it to. */
const LABEL_KEYS: Record<string, string> = {
  Music: "categories.values.music",
  "Video Games": "categories.values.videoGames",
  Film: "categories.values.film",
  Series: "categories.values.series",
  // Retired in favour of "Series" — kept readable so a file tagged before the
  // rename still shows a label instead of the raw value.
  TV: "categories.values.series",
  Anime: "categories.values.anime",
  Cartoon: "categories.values.cartoon",
  Musical: "categories.values.musical",
};

/**
 * A stored category value as it should read on screen. Same split as
 * `useFamilyLabel`: the model keeps the canonical English tag value, and
 * translation lives in a hook so i18n stays out of the pure logic.
 */
export function useCategoryLabel(): (name: string) => string {
  const { t } = useTranslation("library");

  return useCallback(
    (name: string) => {
      const key = LABEL_KEYS[name];
      return key ? t(key) : name;
    },
    [t],
  );
}
