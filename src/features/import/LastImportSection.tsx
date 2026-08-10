import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { useImports } from "@/features/import/hooks";
import { ImportHistoryCard } from "@/features/import/ImportHistoryCard";
import { ActionLink } from "@/shared/ui/ActionLink";

/**
 * The last import, on the page you would run the next one from.
 *
 * The same shape the download page uses: what is happening now on top, what
 * happened before underneath, and a way through to the whole archive. Without
 * it this page forgot everything the moment it was left — you could import a
 * folder, navigate away, come back, and find no trace that anything had ever
 * been imported at all.
 *
 * One record, not five. Downloads happen all week and deserve a feed; imports
 * happen three times a year, and the only one worth repeating here is the last —
 * the rest are what the History page is for.
 *
 * Renders nothing until there is one: an empty state here would be a second
 * invitation on a page whose whole top half is already one.
 */
export function LastImportSection() {
  const { t } = useTranslation("import");
  const imports = useImports();

  const records = imports.data ?? [];
  if (records.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{t("history.last")}</h2>
        {/* Always, not only when there is more than one: the archive holds the
            recap panels, the folder paths and the failures, so it is somewhere
            to go even when it holds exactly this one record. */}
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
