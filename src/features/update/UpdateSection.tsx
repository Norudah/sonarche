import { Button, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { useAppVersion, useInstallUpdate, useUpdateCheck } from "@/features/update/hooks";
import { parseReleaseNotes } from "@/features/update/notes";
import { updateStatus, type Tone } from "@/features/update/status";
import { UpdateNotesCard } from "@/features/update/UpdateNotesCard";

const TONES: Record<Tone, string> = {
  muted: "text-muted",
  success: "text-success",
  danger: "text-danger",
};

/**
 * The manual half of the update story. The app already offers a new version
 * once at launch (`UpdatePrompt`); its toast lands here, and the check result
 * it found is already in the shared cache (`useUpdateCheck`) — so arriving
 * from the toast shows the available version and its notes without asking
 * GitHub twice. The button re-asks on demand for everyone else.
 *
 * It lives in the update feature and is mounted by the router rather than
 * imported by the settings feature — the two share a pane, not a dependency.
 */
export function UpdateSection() {
  const { t } = useTranslation(["update", "settings"]);
  const version = useAppVersion();
  const check = useUpdateCheck();
  const install = useInstallUpdate();

  const update = check.data ?? null;
  const busy = check.isFetching || install.isPending;
  // Derived from the check result, never stored: the card is a view of the
  // update the last check found, not a copy of it.
  const notes = update ? parseReleaseNotes(update.body) : null;
  // Derived on every render, never mirrored into state: a status line kept in a
  // `useState` synced by an effect is how it ends up one press behind.
  const status = updateStatus({
    checking: check.isFetching,
    installing: install.isPending,
    checkFailed: check.isError,
    installFailed: install.isError,
    available: check.data === undefined ? undefined : (check.data?.version ?? null),
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
              <Button variant="primary" onPress={() => install.mutate(update)} isDisabled={busy}>
                {t("install")}
              </Button>
            ) : (
              <Button variant="secondary" onPress={() => void check.refetch()} isDisabled={busy}>
                {t("check")}
              </Button>
            )}
          </div>
        </div>
      </SettingCard>

      {update && notes && (
        <SettingCard>
          <UpdateNotesCard version={update.version} notes={notes} />
        </SettingCard>
      )}
    </>
  );
}
