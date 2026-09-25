import { useCallback } from "react";
import { useTranslation } from "react-i18next";

/** i18n key per canonical value; others are free tags shown as stored. */
const LABEL_KEYS: Record<string, string> = {
  Music: "categories.values.music",
  "Video Games": "categories.values.videoGames",
  Film: "categories.values.film",
  Series: "categories.values.series",
  // Retired alias, still readable on older tags.
  TV: "categories.values.series",
  Anime: "categories.values.anime",
  Cartoon: "categories.values.cartoon",
  Musical: "categories.values.musical",
};

/** Display label for a stored category (i18n kept out of the pure model). */
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
