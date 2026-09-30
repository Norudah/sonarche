import { Button, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { SettingCard, SettingCardHeader } from "@/features/settings/SettingCard";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { useAppVersion, useInstallUpdate, useUpdateCheck } from "@/features/update/hooks";
import { parseReleaseNotes } from "@/features/update/notes";
import { updateStatus, type Tone } from "@/features/update/status";
import { UpdateNotesCard } from "@/features/update/UpdateNotesCard";

const TONES: Record<Tone, string> = {
  muted: "text-muted",
  success: "text-success",
  danger: "text-danger",
};

/** Manual update check in Settings. Shares the launch check's cached result
 * (`useUpdateCheck`). Mounted by the router, not imported by settings. */
export function UpdateSection() {
  const { t } = useTranslation("update");
  const version = useAppVersion();
  const check = useUpdateCheck();
  const install = useInstallUpdate();

  const update = check.data ?? null;
  const busy = check.isFetching || install.isPending;
  const notes = update ? parseReleaseNotes(update.body) : null;
  const status = updateStatus({
    checking: check.isFetching,
    installing: install.isPending,
    checkFailed: check.isError,
    installFailed: install.isError,
    available: check.data === undefined ? undefined : (check.data?.version ?? null),
  });

  return (
    <>
      <SectionHeader title={t("category")} description={t("description")} />

      <SettingCard>
        <div className="flex flex-col gap-3">
          <SettingCardHeader
            title={t("current")}
            trailing={<span className="font-mono text-[0.8125rem] text-muted">{version.data ?? "—"}</span>}
          />

          <div className="flex items-center justify-between gap-3 border-t border-separator/60 pt-3">
            <p className={`flex items-center gap-2 text-[0.8125rem] ${status ? TONES[status.tone] : ""}`}>
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
