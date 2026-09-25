import { toast } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { checkForUpdate } from "@/features/update/hooks";
import type { Update } from "@/features/update/install";
import { installUpdate } from "@/features/update/install";
import { parseReleaseNotes } from "@/features/update/notes";
import { openSettings } from "@/shared/lib/settingsDialog";
import { TOAST_EXPLAINED, TOAST_OFFER } from "@/shared/toast/durations";

/**
 * Offers a new version once, after launch, as a toast. Its action opens
 * Settings › Updates (same cached check result, with the notes and Install);
 * it offers the install directly only when the notes are unreadable.
 */
export function UpdatePrompt() {
  const { t } = useTranslation("update");
  const queryClient = useQueryClient();
  // StrictMode runs effects twice.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    // Silent on failure: offline users shouldn't notice anything.
    void checkForUpdate(queryClient)
      .then((update) => {
        if (!update) return;
        const hasNotes = parseReleaseNotes(update.body) !== null;
        toast(t("available"), {
          description: t("version", { version: update.version }),
          // Settings offers the same install, so it can time out.
          timeout: TOAST_OFFER,
          actionProps: hasNotes
            ? { children: t("notes.view"), onPress: () => openSettings("updates") }
            : { children: t("install"), onPress: () => void install(update, t) },
        });
      })
      .catch(() => undefined);
  }, [t, queryClient]);

  return null;
}

async function install(update: Update, t: (key: string) => string) {
  // A progress line: stays until the install relaunches or fails.
  const progress = toast(t("installing"), { timeout: 0, isLoading: true });
  try {
    await installUpdate(update);
  } catch {
    toast.close(progress);
    toast.danger(t("failed"), { description: t("failedHint"), timeout: TOAST_EXPLAINED });
  }
}
