import { Radio, RadioGroup } from "@heroui/react";
import { Folder, Music, Tags } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Grouping, ScanReport } from "@/features/import/api";
import { isSuggestionNotable } from "@/features/import/grouping";
import { Swap } from "@/shared/motion/Swap";
import { layoutIds, springs } from "@/shared/motion/tokens";

const GROUPINGS: Grouping[] = ["folder", "tags", "tracks"];

/* Each glyph is the answer itself: folder, tag, note. */
const ICONS: Record<Grouping, typeof Folder> = { folder: Folder, tags: Tags, tracks: Music };

const SEGMENT = "relative mt-0 rounded-full";
const SEGMENT_CONTENT =
  "relative gap-1.5 px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors " +
  "text-muted hover:text-foreground data-[selected]:text-accent";

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
 * What counts as an album in the imported folder. beets makes one album per
 * directory, which turns a folder of unrelated rips into one bogus album.
 * The heading asks the question; one panel explains the selected answer.
 */
export function GroupingChoice({
  value,
  report,
  isDisabled,
  onChange,
}: {
  value: Grouping;
  /** Null before a scan; the options stay readable without a suggestion. */
  report: ScanReport | null;
  isDisabled: boolean;
  onChange: (grouping: Grouping) => void;
}) {
  const { t } = useTranslation("import");
  const suggested = report != null && isSuggestionNotable(report);

  return (
    <fieldset disabled={isDisabled} className="flex flex-col gap-2.5 disabled:opacity-50">
      <div className="flex flex-col gap-0.5">
        <legend className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
          {t("grouping.label")}
        </legend>
        <p className="max-w-prose text-xs leading-relaxed text-muted">{t("grouping.intro")}</p>
      </div>

      <RadioGroup
        value={value}
        onChange={(next) => onChange(next as Grouping)}
        aria-label={t("grouping.label")}
        className="flex w-fit flex-row gap-0.5 rounded-full bg-default/60 p-0.5"
      >
        {GROUPINGS.map((grouping) => (
          <Segment key={grouping} value={grouping} selected={value}>
            {t(`grouping.${grouping}`)}
          </Segment>
        ))}
      </RadioGroup>

      {/* Keyed on the answer so the text swaps visibly. */}
      <Swap swapKey={value} mode="cross" className="flex flex-col gap-0.5 rounded-xl bg-default/40 px-3 py-2.5">
        <p className="text-[0.8125rem] font-medium text-accent">{t(`grouping.${value}Answer`)}</p>
        <p className="max-w-prose text-[0.8125rem] leading-relaxed">{t(`grouping.${value}Why`)}</p>
        <p className="max-w-prose text-xs leading-relaxed text-muted italic">{t(`grouping.${value}For`)}</p>
      </Swap>

      {suggested && (
        <p className="text-xs leading-relaxed text-accent">
          {t("grouping.suggested", { count: report?.largestFolder ?? 0 })}
        </p>
      )}
    </fieldset>
  );
}
