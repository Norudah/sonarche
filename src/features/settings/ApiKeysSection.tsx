import { Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { ApiKeyCard } from "@/features/settings/ApiKeyCard";
import { ServiceHealthCard } from "@/features/settings/ServiceHealthCard";
import { SettingsHero } from "@/features/settings/SettingsHero";
import { useApiKeys } from "@/features/settings/hooks";

/** The keys the app stores, and — under them — whether the services those keys
 * talk to are up at all. The two belong on one screen: "my key stopped
 * working" and "the service stopped answering" look identical from the
 * outside, and this is where someone comes to tell them apart. */
export function ApiKeysSection() {
  const { t } = useTranslation("settings");
  const keys = useApiKeys();

  return (
    <>
      <SettingsHero eyebrow={t("title")} title={t("apiKeys.title")} description={t("apiKeys.description")} />

      {keys.isPending ? (
        <Spinner size="sm" aria-label={t("loading")} />
      ) : (
        (keys.data ?? []).map((status) => <ApiKeyCard key={status.name} status={status} />)
      )}

      <ServiceHealthCard />
    </>
  );
}
