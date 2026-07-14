import { Button, Spinner } from "@heroui/react";
import { KeyRound, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { paths } from "@/app/routes";
import type { ApiKeyName } from "@/features/settings/api";
import { ApiKeysSection } from "@/features/settings/ApiKeysSection";
import { useApiKeys, useSetApiKey } from "@/features/settings/hooks";

/** Standalone screen, outside the main app layout: category menu on the left,
 * category content on the right, one global save action. */
export function SettingsPage() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const keys = useApiKeys();
  const setKey = useSetApiKey();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const dirty = Object.values(drafts).some((value) => value.trim() !== "");

  const save = async () => {
    for (const [name, value] of Object.entries(drafts)) {
      if (value.trim()) {
        await setKey.mutateAsync({ name: name as ApiKeyName, value });
      }
    }
    setDrafts({});
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between border-b border-separator px-6 py-4">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("close")}
          onPress={() => navigate(paths.download)}
        >
          <X className="size-5" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 gap-6 p-6">
        <nav className="w-56 shrink-0 rounded-xl border border-separator bg-surface p-2">
          <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-accent">
            <KeyRound className="size-4" />
            {t("apiKeys.category")}
          </div>
        </nav>

        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-separator bg-surface">
          <div className="flex-1 overflow-y-auto p-6">
            {keys.isPending ? (
              <Spinner size="sm" aria-label={t("loading")} />
            ) : (
              <ApiKeysSection
                keys={keys.data ?? []}
                drafts={drafts}
                onDraftChange={(name, value) => setDrafts((prev) => ({ ...prev, [name]: value }))}
              />
            )}
          </div>
          <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-separator px-6 py-4">
            {setKey.isError && (
              <p className="text-sm text-danger">{String(setKey.error)}</p>
            )}
            {setKey.isSuccess && !dirty && (
              <p className="text-sm text-success">{t("saved")}</p>
            )}
            <Button
              variant="primary"
              onPress={save}
              isDisabled={!dirty || setKey.isPending}
            >
              {setKey.isPending ? t("saving") : t("save")}
            </Button>
          </footer>
        </section>
      </div>
    </div>
  );
}
