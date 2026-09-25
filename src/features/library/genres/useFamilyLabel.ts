import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { FAMILY_NONE, FAMILY_OTHER } from "@/features/library/genres/genres";

/** Family display label: real keys are the sidecar's English names, only the
 * sentinels are translated (kept out of the pure model). */
export function useFamilyLabel(): (key: string) => string {
  const { t } = useTranslation("library");

  return useCallback(
    (key: string) => {
      if (key === FAMILY_OTHER) return t("genres.other");
      if (key === FAMILY_NONE) return t("genres.none");
      return key;
    },
    [t],
  );
}
