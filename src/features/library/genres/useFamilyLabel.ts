import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { FAMILY_NONE, FAMILY_OTHER } from "@/features/library/genres/genres";

/**
 * A family key as it should read on screen.
 *
 * The model deliberately keeps no label: a real family key is the English name
 * the sidecar's genre tree produced ("R&B, Soul & Funk") and it stays as-is, while
 * the two sentinels are the only ones that need translating. Putting that split
 * in a hook rather than in `groupFamilies` keeps i18n out of the pure logic —
 * and out of its tests.
 */
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
