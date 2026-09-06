import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { ApiKeyCard } from "@/features/settings/ApiKeyCard";
import { FixedDelaysCard } from "@/features/settings/FixedDelaysCard";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { ServiceHealthCard } from "@/features/settings/ServiceHealthCard";
import { useApiKeys, usePreferences } from "@/features/settings/hooks";

/**
 * Everything about the outside world the app talks to, on one screen.
 *
 * Three panes became one. "My key stopped working", "the service stopped
 * answering" and "I am being throttled" are indistinguishable symptoms from
 * where the user stands — an import comes back with no cover — and they were
 * filed under three different headings, one of which held a single read-only
 * card. Reading down the pane now answers the question in the order it gets
 * asked: is my key in? are they up? how fast are we allowed to ask?
 */
export function ServicesSection() {
  const { t } = useTranslation("settings");
  const keys = useApiKeys();
  const preferences = usePreferences();

  return (
    <>
      <SectionHeader title={t("services.title")} description={t("services.description")} />

      {keys.isPending ? (
        <Spinner size="sm" aria-label={t("loading")} />
      ) : (
        (keys.data ?? []).map((status) => <ApiKeyCard key={status.name} status={status} />)
      )}

      <ServiceHealthCard />

      {preferences.data && <FixedDelaysCard preferences={preferences.data} />}
    </>
  );
}
