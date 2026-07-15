import { useTranslation } from "react-i18next";

import { PageContainer } from "@/shared/ui/PageContainer";

export function BrowseGenresPage() {
  const { t } = useTranslation("browse");

  return (
    <PageContainer>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("genres.title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("genres.subtitle")}</p>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-separator py-16 text-center">
        <p className="text-4xl">♪</p>
        <p className="text-muted">{t("comingSoon")}</p>
      </div>
    </PageContainer>
  );
}
