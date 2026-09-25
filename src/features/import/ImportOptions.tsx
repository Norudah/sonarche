import { Disclosure } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Grouping, ScanReport } from "@/features/import/api";
import { GroupingChoice } from "@/features/import/GroupingChoice";
import { CategoryChoice } from "@/features/library/categories/CategoryChoice";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useAutoExpand } from "@/shared/lib/optionPanels";

interface ImportOptionsProps {
  grouping: Grouping;
  category: string | null;
  /** Null before a scan; only the suggestion needs a folder. */
  report: ScanReport | null;
  isDisabled: boolean;
  onGroupingChange: (grouping: Grouping) => void;
  onCategoryChange: (category: string | null) => void;
}

/**
 * The import options on the card, like the composer's options strip. Opens on
 * each new scan (unless disabled in Settings); readable without a folder. The
 * trigger summarises both answers.
 */
export function ImportOptions({
  grouping,
  category,
  report,
  isDisabled,
  onGroupingChange,
  onCategoryChange,
}: ImportOptionsProps) {
  const { t } = useTranslation("import");
  const labelOf = useCategoryLabel();
  const autoExpand = useAutoExpand("import");

  return (
    <Disclosure
      // Remounted per folder and preference change, so `defaultExpanded` re-applies.
      key={`${report?.largestFolder ?? "none"}:${autoExpand}`}
      defaultExpanded={autoExpand && report != null}
      className="border-t border-separator/60 bg-panel px-3 py-2"
    >
      <Disclosure.Trigger className="flex w-full cursor-pointer items-center justify-between gap-4 rounded-lg px-1 py-1 text-xs font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40">
        <span className="flex items-center gap-1">
          {t("options.title")}
          <Disclosure.Indicator>
            <ChevronDown className="size-3.5" />
          </Disclosure.Indicator>
        </span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate rounded-full bg-default/70 px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
            {t(`grouping.${grouping}Answer`)}
          </span>
          <span className="shrink-0 rounded-full bg-default/70 px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
            {category ? labelOf(category) : t("category.none")}
          </span>
        </span>
      </Disclosure.Trigger>

      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-4 px-1 pt-3 pb-1">
          <GroupingChoice value={grouping} report={report} isDisabled={isDisabled} onChange={onGroupingChange} />
          <hr className="border-separator/70" />
          <CategoryChoice
            value={category}
            label={t("category.label")}
            hint={t("category.hint")}
            noneLabel={t("category.none")}
            isDisabled={isDisabled}
            onChange={onCategoryChange}
          />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
