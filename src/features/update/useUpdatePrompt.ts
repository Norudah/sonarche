import { toast } from "@heroui/react";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import type { Update } from "@/features/update/install";
import { installUpdate } from "@/features/update/install";
import { TOAST_EXPLAINED, TOAST_OFFER } from "@/shared/toast/durations";

/**
 * Offer the new version, once, shortly after launch.
 *
 * A toast rather than a screen or a badge: an update is worth mentioning and
 * never worth interrupting for. It is the longest-lived toast in the app —
 * everything else reports something that already happened, and this one asks a
 * question — but it does leave on its own, because the answer is never lost:
 * Réglages → Mises à jour asks it again on demand.
 *
 * Checked at launch and not again: the app is opened, used, and closed, and a
 * poll running all day would only find what the next launch finds anyway.
 */
export function useUpdatePrompt() {
  const { t } = useTranslation("update");
  // Effects run twice in StrictMode, and two identical prompts stacked on top
  // of each other is how a careful check reads as a bug.
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    // Deliberately unawaited and deliberately quiet: the check talks to GitHub,
    // and a machine that is offline or behind a captive portal should notice
    // nothing at all. A failure here is not the user's problem.
    void check()
      .then((update) => {
        if (!update) return;
        toast(t("available"), {
          description: t("version", { version: update.version }),
          // It used to sit there until dismissed by hand. Nothing is lost when
          // it goes: Réglages → Mises à jour offers the same install, and a
          // notice that outstays its welcome is the one people learn to swat.
          timeout: TOAST_OFFER,
          actionProps: {
            children: t("install"),
            onPress: () => void install(update, t),
          },
        });
      })
      .catch(() => undefined);
  }, [t]);
}

async function install(update: Update, t: (key: string) => string) {
  // `timeout: 0` on purpose, and the one toast that keeps it: this is a
  // progress line, not a message — it has to stand until the install ends
  // (which relaunches the app) or fails. A timer-less toast is skipped by the
  // countdown pass in `ToastViewport`.
  const progress = toast(t("installing"), { timeout: 0, isLoading: true });
  try {
    await installUpdate(update);
  } catch {
    toast.close(progress);
    toast.danger(t("failed"), { description: t("failedHint"), timeout: TOAST_EXPLAINED });
  }
}
