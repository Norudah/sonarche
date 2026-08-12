import { Button, Spinner } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { useAppVersion, useCheckForUpdate, useInstallUpdate } from "@/features/update/hooks";
import { parseReleaseNotes } from "@/features/update/notes";
import { updateStatus, type Tone } from "@/features/update/status";
import { UpdateNotesModal } from "@/features/update/UpdateNotesModal";

const TONES: Record<Tone, string> = {
  muted: "text-muted",
  success: "text-success",
  danger: "text-danger",
};

/**
 * The manual half of the update story. The app already offers a new version
 * once at launch (`useUpdatePrompt`); this is for the user who dismissed that
 * toast, or who just wants to know.
 *
 * It lives in the update feature and is mounted by the router rather than
 * imported by the settings feature — the two share a pane, not a dependency.
 */
export function UpdateSection() {
  const { t } = useTranslation(["update", "settings"]);
  const version = useAppVersion();
  const check = useCheckForUpdate();
  const install = useInstallUpdate();

  const update = check.data;
  const busy = check.isPending || install.isPending;
  const [showNotes, setShowNotes] = useState(false);
  // Derived from the check result, never stored: the modal is a view of the
  // update the last check found, not a copy of it.
  const notes = update ? parseReleaseNotes(update.body) : null;
  // Derived on every render, never mirrored into state: a status line kept in a
  // `useState` synced by an effect is how it ends up one press behind.
  const status = updateStatus({
    checking: check.isPending,
    installing: install.isPending,
    checkFailed: check.isError,
    installFailed: install.isError,
    available: update === undefined ? undefined : (update?.version ?? null),
  });

  return (
    <>
      <SettingsHero eyebrow={t("settings:title")} title={t("category")} description={t("description")} />

      <SettingCard>
        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-medium">{t("current")}</h3>
            <span className="font-mono text-sm text-muted">{version.data ?? "—"}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <p className={`flex items-center gap-2 text-sm ${status ? TONES[status.tone] : ""}`}>
              {busy && <Spinner size="sm" aria-hidden />}
              {status && t(status.key, { version: status.version })}
            </p>

            {update ? (
              <span className="flex items-center gap-2">
                {notes && (
                  <Button variant="ghost" onPress={() => setShowNotes(true)} isDisabled={busy}>
                    {t("notes.view")}
                  </Button>
                )}
                <Button variant="primary" onPress={() => install.mutate(update)} isDisabled={busy}>
                  {t("install")}
                </Button>
              </span>
            ) : (
              <Button variant="secondary" onPress={() => check.mutate()} isDisabled={busy}>
                {t("check")}
              </Button>
            )}
          </div>
        </div>
      </SettingCard>

      {update && notes && (
        <UpdateNotesModal
          isOpen={showNotes}
          onClose={() => setShowNotes(false)}
          version={update.version}
          notes={notes}
          onInstall={() => {
            setShowNotes(false);
            install.mutate(update);
          }}
        />
      )}
    </>
  );
}
