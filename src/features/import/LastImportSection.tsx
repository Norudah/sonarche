import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { useImports } from "@/features/import/hooks";
import { ImportHistoryCard } from "@/features/import/ImportHistoryCard";
import { ActionLink } from "@/shared/ui/ActionLink";

/** The last import, under the next one. Renders nothing until there is one. */
export function LastImportSection() {
  const { t } = useTranslation("import");
  const imports = useImports();

  const records = imports.data ?? [];
  if (records.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{t("history.last")}</h2>
        {/* Always: the archive holds more detail even for a single record. */}
        <ActionLink to={paths.history} trailingIcon={ArrowRight}>
          {t("history.seeAll")}
        </ActionLink>
      </div>
      <div className="rounded-2xl bg-tray p-1.5">
        <ImportHistoryCard record={records[0]} />
      </div>
    </section>
  );
}
