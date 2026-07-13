import { useTranslation } from "react-i18next";

import { PageContainer } from "@/shared/ui/PageContainer";

export function LibraryPlaceholder({ title }: { title: string }) {
  const { t } = useTranslation("library");

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-separator py-16 text-center">
        <p className="text-4xl">♪</p>
        <p className="text-muted">{t("views.comingSoon")}</p>
      </div>
    </PageContainer>
  );
}
