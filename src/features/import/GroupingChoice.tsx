import { Radio, RadioGroup } from "@heroui/react";
import { Folder, Music, Tags } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Grouping, ScanReport } from "@/features/import/api";
import { isSuggestionNotable } from "@/features/import/grouping";
import { layoutIds, springs } from "@/shared/motion/tokens";

const GROUPINGS: Grouping[] = ["folder", "tags", "tracks"];

/* Not decoration: each glyph *is* the answer — a folder, a tag, a note. The
 * label beside it names the same thing in one word. */
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
 * What counts as an album in the folder about to be imported.
 *
 * The question nobody was asked, and the one that decided the most: beets makes
 * one album per *directory* with no opinion about whether that directory is a
 * release, so a folder of one-shot rips arrived as a single record named after
 * the folder with fourteen unrelated artists filed under it.
 *
 * It used to be three switches with a paragraph under the selected one, and
 * nobody — including the person who asked for it — could tell them apart. The
 * paragraphs described the *mechanism* without ever naming the *question*, so
 * they read as three ways of saying "it imports the music".
 *
 * So the question leads, in the heading, and each answer is one word: the
 * folder, the tags, nothing. The three are laid out together rather than one at
 * a time — a choice you cannot see the alternatives of is not a choice — and
 * each carries what it produces and who it is for, because "which one am I" is
 * the question actually being asked.
 */
export function GroupingChoice({
  value,
  report,
  isDisabled,
  onChange,
}: {
  value: Grouping;
  /** Null before a folder is scanned: the options are readable then, they just
   * have nothing to be suggested about. */
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

      {/* Every answer, always — the selected one lit. Reading one description at
          a time means holding the other two in your head to compare them, which
          is exactly what nobody could do. */}
      <dl className="flex flex-col gap-1.5">
        {GROUPINGS.map((grouping) => (
          <div
            key={grouping}
            className={
              "flex flex-col gap-0.5 rounded-lg px-2.5 py-1.5 text-[0.8125rem] leading-relaxed transition-colors " +
              (value === grouping ? "bg-accent-soft/60" : "")
            }
          >
            <dt className={"font-medium " + (value === grouping ? "text-accent" : "text-muted")}>
              {t(`grouping.${grouping}Answer`)}
            </dt>
            <dd className={value === grouping ? "" : "text-muted"}>
              {t(`grouping.${grouping}Why`)} <span className="text-muted italic">{t(`grouping.${grouping}For`)}</span>
            </dd>
          </div>
        ))}
      </dl>

      {suggested && (
        <p className="text-xs leading-relaxed text-accent">
          {t("grouping.suggested", { count: report?.largestFolder ?? 0 })}
        </p>
      )}
    </fieldset>
  );
}
