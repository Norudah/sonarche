import { toast } from "@heroui/react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Offer the new version, once, shortly after launch.
 *
 * A toast rather than a screen or a badge: an update is worth mentioning and
 * never worth interrupting for. It is the one toast in the app with no
 * timeout — everything else here reports something that already happened, and
 * this one asks a question, which cannot expire while the user reads it.
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
          timeout: 0,
          actionProps: {
            children: t("install"),
            onPress: () => void install(update, t),
          },
        });
      })
      .catch(() => undefined);
  }, [t]);
}

type Update = NonNullable<Awaited<ReturnType<typeof check>>>;

async function install(update: Update, t: (key: string) => string) {
  const progress = toast(t("installing"), { timeout: 0, isLoading: true });
  try {
    await update.downloadAndInstall();
    // The new bundle is on disk, but the process still running is the old one.
    await relaunch();
  } catch {
    toast.close(progress);
    toast.danger(t("failed"), { description: t("failedHint") });
  }
}
