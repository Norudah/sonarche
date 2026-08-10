import { Disclosure } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Grouping, ScanReport } from "@/features/import/api";
import { GroupingChoice } from "@/features/import/GroupingChoice";
import { CategoryChoice } from "@/features/library/categories/CategoryChoice";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

interface ImportOptionsProps {
  grouping: Grouping;
  category: string | null;
  /** Null before a folder has been scanned. The options stay readable — the
   * suggestion is the only thing that needs a folder. */
  report: ScanReport | null;
  isDisabled: boolean;
  onGroupingChange: (grouping: Grouping) => void;
  onCategoryChange: (category: string | null) => void;
}

/**
 * What the import will do, decided on the card that does it.
 *
 * These two questions used to sit loose on the page between the picker and the
 * card, appearing only once a folder had been scanned — so the one moment you
 * could read them was the moment you were being asked to answer them, and the
 * card that carried out the answer never mentioned it. They are the download
 * composer's options strip, which is the shape this app already has for "here
 * is what is about to happen, adjust it".
 *
 * Closed until a folder is in hand, then opened by the scan itself. An import
 * is not the passive act a download is — something *is* being decided here, and
 * a panel that stays shut lets the user press Import without ever learning
 * that. It reopens on each new folder (the key), and closes again by hand.
 *
 * Readable with no folder at all, too: someone wondering what an import even
 * does can open it and find out, which is the other half of what the help mark
 * on the lead does.
 *
 * The trigger summarises both answers, for the same reason the composer's does:
 * a collapsed panel that hides what it is set to is a panel you have to open
 * every time to be sure.
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

  return (
    <Disclosure
      // Remounted per folder so a new scan re-opens the panel: the decision is
      // about *this* folder, and the last one's answer was reviewed already.
      key={report?.largestFolder ?? "none"}
      defaultExpanded={report != null}
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
