import { useTranslation } from "react-i18next";

import { PageContainer } from "@/shared/ui/PageContainer";

export function MetadataPage() {
  const { t } = useTranslation("metadata");

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-separator py-16 text-center">
        <p className="text-4xl">♪</p>
        <p className="text-muted">{t("comingSoon")}</p>
      </div>
    </PageContainer>
  );
}
