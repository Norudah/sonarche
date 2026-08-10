import { Radio, RadioGroup } from "@heroui/react";
import { Disc3, Music, Tags } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Grouping, ScanReport } from "@/features/import/api";
import { isSuggestionNotable } from "@/features/import/grouping";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The composer's segmented control, verbatim — see `KindChoice` for why the
 * pill shape and the padding sit on different elements. */
const SEGMENT = "relative mt-0 rounded-full";
const SEGMENT_CONTENT =
  "relative gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors " +
  "text-muted hover:text-foreground data-[selected]:text-accent";

const ICONS: Record<Grouping, typeof Disc3> = { folder: Disc3, tags: Tags, tracks: Music };

function Segment({ value, selected, children }: { value: Grouping; selected: Grouping; children: ReactNode }) {
  const Icon = ICONS[value];

  return (
    <Radio.Root value={value} className={SEGMENT}>
      {selected === value && (
        <motion.span
          layoutId={layoutIds.grouping}
          transition={springs.snappy}
          className="absolute inset-0 rounded-full bg-surface shadow-xs"
        />
      )}
      <Radio.Content className={SEGMENT_CONTENT}>
        <Icon className="size-3.5 shrink-0" />
        {children}
      </Radio.Content>
    </Radio.Root>
  );
}

/**
 * What counts as an album in the folder about to be imported.
 *
 * The question nobody was asked, and the one that decided the most. beets makes
 * one album per directory with no opinion about whether that directory is a
 * release, so a folder of one-shot rips arrived as a single record named after
 * the folder with fourteen unrelated artists filed under it — and no screen had
 * said that was going to happen.
 *
 * It appears with the scan and not before: the choice is about *this* folder,
 * and the shape of this folder is what preselects an answer. The line under the
 * switch always states what the selected mode will produce, so the decision is
 * readable without opening the explainer — and when the suggestion departs from
 * beets' default, it says what in the folder prompted it.
 */
export function GroupingChoice({
  value,
  report,
  isDisabled,
  onChange,
}: {
  value: Grouping;
  report: ScanReport;
  isDisabled: boolean;
  onChange: (grouping: Grouping) => void;
}) {
  const { t } = useTranslation("import");

  return (
    <div className="flex flex-col gap-1.5">
      <RadioGroup
        value={value}
        isDisabled={isDisabled}
        onChange={(next) => onChange(next as Grouping)}
        aria-label={t("grouping.label")}
        className="flex w-fit flex-row gap-0.5 rounded-full bg-default/60 p-0.5"
      >
        <Segment value="folder" selected={value}>
          {t("grouping.folder")}
        </Segment>
        <Segment value="tags" selected={value}>
          {t("grouping.tags")}
        </Segment>
        <Segment value="tracks" selected={value}>
          {t("grouping.tracks")}
        </Segment>
      </RadioGroup>

      <p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted">
        {t(`grouping.${value}Why`)}
        {isSuggestionNotable(report) && value === "tracks" && (
          <> {t("grouping.suggested", { count: report.largestFolder })}</>
        )}
      </p>
    </div>
  );
}
