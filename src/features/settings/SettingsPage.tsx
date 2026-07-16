import { Button, Spinner } from "@heroui/react";
import { Gauge, KeyRound, Wrench, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { paths } from "@/app/routes";
import type { ApiKeyName } from "@/features/settings/api";
import { ApiKeysSection } from "@/features/settings/ApiKeysSection";
import { DeveloperSection } from "@/features/settings/DeveloperSection";
import { useApiKeys, usePreferences, useSetApiKey, useSetLastfmFetchDelay } from "@/features/settings/hooks";
import { RateLimitsSection } from "@/features/settings/RateLimitsSection";

type Category = "apiKeys" | "rateLimits" | "developer";

/** Standalone screen, outside the main app layout: category menu on the left,
 * category content on the right. API keys need an explicit save; rate limits
 * auto-save on slider release, so the footer only applies to the former. */
export function SettingsPage() {
  const { t } = useTranslation("settings");
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category>("apiKeys");

  const keys = useApiKeys();
  const setKey = useSetApiKey();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const dirty = Object.values(drafts).some((value) => value.trim() !== "");

  const preferences = usePreferences();
  const setDelay = useSetLastfmFetchDelay();

  const save = async () => {
    for (const [name, value] of Object.entries(drafts)) {
      if (value.trim()) {
        await setKey.mutateAsync({ name: name as ApiKeyName, value });
      }
    }
    setDrafts({});
  };

  const categories: { key: Category; label: string; icon: typeof KeyRound }[] = [
    { key: "apiKeys", label: t("apiKeys.category"), icon: KeyRound },
    { key: "rateLimits", label: t("rateLimits.category"), icon: Gauge },
    // Dev builds only; the backend command refuses to run in release anyway.
    ...(import.meta.env.DEV
      ? [{ key: "developer" as const, label: t("developer.category"), icon: Wrench }]
      : []),
  ];

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
        <nav className="flex w-56 shrink-0 flex-col gap-1 rounded-xl border border-separator bg-surface p-2">
          {categories.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setCategory(key)}
              className={
                "flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors" +
                (category === key ? " bg-accent/10 text-accent" : " text-muted hover:bg-default/40")
              }
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </nav>

        <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-separator bg-surface">
          <div className="flex-1 overflow-y-auto p-6">
            {category === "apiKeys" &&
              (keys.isPending ? (
                <Spinner size="sm" aria-label={t("loading")} />
              ) : (
                <ApiKeysSection
                  keys={keys.data ?? []}
                  drafts={drafts}
                  onDraftChange={(name, value) => setDrafts((prev) => ({ ...prev, [name]: value }))}
                />
              ))}
            {category === "rateLimits" &&
              (preferences.isPending ? (
                <Spinner size="sm" aria-label={t("loading")} />
              ) : (
                <RateLimitsSection
                  preferences={preferences.data!}
                  onChangeDelay={(seconds) => setDelay.mutate(seconds)}
                />
              ))}
            {category === "developer" && <DeveloperSection />}
          </div>
          {category === "apiKeys" && (
            <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-separator px-6 py-4">
              {setKey.isError && <p className="text-sm text-danger">{String(setKey.error)}</p>}
              {setKey.isSuccess && !dirty && <p className="text-sm text-success">{t("saved")}</p>}
              <Button variant="primary" onPress={save} isDisabled={!dirty || setKey.isPending}>
                {setKey.isPending ? t("saving") : t("save")}
              </Button>
            </footer>
          )}
          {category === "rateLimits" && setDelay.isError && (
            <footer className="flex shrink-0 items-center justify-end border-t border-separator px-6 py-4">
              <p className="text-sm text-danger">{String(setDelay.error)}</p>
            </footer>
          )}
        </section>
      </div>
    </div>
  );
}
