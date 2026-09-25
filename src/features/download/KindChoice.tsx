import { Radio, RadioGroup } from "@heroui/react";
import { Disc3, Music } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import type { DetectedUrlKind } from "@/features/download/urlKind";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* The pill shape goes on the root, the hit-area padding on Content (HeroUI's
 * `.radio__content` is the clickable row); `mt-0` drops its stacked margin. */
const SEGMENT = "relative mt-0 rounded-full";
/* `.radio__content` sets its own colour, so the text state is declared here. */
const SEGMENT_CONTENT =
  "relative gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors " +
  "text-muted hover:text-foreground data-[selected]:text-accent";
const SEGMENT_DISABLED = "cursor-not-allowed opacity-40 hover:text-muted";

function Segment({
  kind,
  selected,
  isDisabled,
  children,
}: {
  kind: JobKind;
  selected: JobKind;
  isDisabled: boolean;
  children: ReactNode;
}) {
  return (
    <Radio.Root value={kind} isDisabled={isDisabled} className={SEGMENT}>
      {selected === kind && (
        <motion.span
          layoutId={layoutIds.kindChoice}
          transition={springs.snappy}
          className="absolute inset-0 rounded-full bg-surface shadow-xs"
        />
      )}
      <Radio.Content className={`${SEGMENT_CONTENT} ${isDisabled ? SEGMENT_DISABLED : ""}`}>{children}</Radio.Content>
    </Radio.Root>
  );
}

/** Album or single. Always shown; a segment the link can't support is
 * disabled rather than hidden. */
export function KindChoice({
  value,
  detected,
  onChange,
}: {
  value: JobKind;
  detected: DetectedUrlKind;
  onChange: (kind: JobKind) => void;
}) {
  const { t } = useTranslation("download");
  // Only a video opened from a playlist is a real choice.
  const canAlbum = detected !== "single";
  const canSingle = detected !== "album";

  return (
    <RadioGroup
      value={value}
      onChange={(next) => onChange(next as JobKind)}
      aria-label={t("detected.question")}
      className="flex w-fit flex-row gap-0.5 rounded-full bg-default/60 p-0.5"
    >
      <Segment kind="album" selected={value} isDisabled={!canAlbum}>
        <Disc3 className="size-3.5 shrink-0" />
        {t("detected.choicePlaylist")}
      </Segment>
      <Segment kind="single" selected={value} isDisabled={!canSingle}>
        <Music className="size-3.5 shrink-0" />
        {t("detected.choiceTrack")}
      </Segment>
    </RadioGroup>
  );
}
