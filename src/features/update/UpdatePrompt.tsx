import { toast } from "@heroui/react";
import { check } from "@tauri-apps/plugin-updater";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Update } from "@/features/update/install";
import { installUpdate } from "@/features/update/install";
import { parseReleaseNotes } from "@/features/update/notes";
import { UpdateNotesModal } from "@/features/update/UpdateNotesModal";
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
 * The toast's one action is "see what's new", not "install": nobody should be
 * asked to restart the app on the strength of a version number. The modal
 * makes the case, and Install lives there. Only when the release body yields
 * nothing readable does the toast fall back to offering the install directly.
 *
 * Checked at launch and not again: the app is opened, used, and closed, and a
 * poll running all day would only find what the next launch finds anyway.
 */
export function UpdatePrompt() {
  const { t } = useTranslation("update");
  // Effects run twice in StrictMode, and two identical prompts stacked on top
  // of each other is how a careful check reads as a bug.
  const asked = useRef(false);
  const [offer, setOffer] = useState<Update | null>(null);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    // Deliberately unawaited and deliberately quiet: the check talks to GitHub,
    // and a machine that is offline or behind a captive portal should notice
    // nothing at all. A failure here is not the user's problem.
    void check()
      .then((update) => {
        if (!update) return;
        const hasNotes = parseReleaseNotes(update.body) !== null;
        toast(t("available"), {
          description: t("version", { version: update.version }),
          // It used to sit there until dismissed by hand. Nothing is lost when
          // it goes: Réglages → Mises à jour offers the same install, and a
          // notice that outstays its welcome is the one people learn to swat.
          timeout: TOAST_OFFER,
          actionProps: hasNotes
            ? { children: t("notes.view"), onPress: () => setOffer(update) }
            : { children: t("install"), onPress: () => void install(update, t) },
        });
      })
      .catch(() => undefined);
  }, [t]);

  // Mounted with empty props rather than conditionally: the modal component
  // stays in the tree so its open/close transitions actually run.
  const notes = offer ? parseReleaseNotes(offer.body) : null;
  return (
    <UpdateNotesModal
      isOpen={notes !== null}
      onClose={() => setOffer(null)}
      version={offer?.version ?? ""}
      notes={notes ?? { highlights: [], sections: [] }}
      onInstall={() => {
        setOffer(null);
        if (offer) void install(offer, t);
      }}
    />
  );
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
