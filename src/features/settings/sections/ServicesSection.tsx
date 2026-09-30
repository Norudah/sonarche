import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { ApiKeyCard } from "@/features/settings/ApiKeyCard";
import { FixedDelaysCard } from "@/features/settings/FixedDelaysCard";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { ServiceHealthCard } from "@/features/settings/ServiceHealthCard";
import { useApiKeys, usePreferences } from "@/features/settings/hooks";

/** Keys, service health and fixed delays on one pane: from the outside, the
 * three problems look the same. */
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
