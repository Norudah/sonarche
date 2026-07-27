import { Radio, RadioGroup } from "@heroui/react";
import { Disc3, Music } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import type { DetectedUrlKind } from "@/features/download/urlKind";
import { layoutIds, springs } from "@/shared/motion/tokens";

/* HeroUI's `.radio` is a column whose `.radio__content` row is the only
 * clickable area — so the pill shape goes on the root while the padding that
 * makes it a real target lives on Content. */
/* `.radio` carries a 16px top margin for HeroUI's stacked layout — useless
 * here, and it is what pads the pill open at the top. */
/* The selected background is no longer a `data-[selected]` style: one shared
 * pill slides between the two segments instead, so the choice reads as a
 * switch being thrown rather than two independent buttons lighting up. */
const SEGMENT = "relative mt-0 rounded-full";
/* HeroUI's `.radio__content` sets its own color, so the text state has to be
 * declared here rather than inherited from the root. */
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

/**
 * What to make of the pasted link: the whole set, or the one track.
 *
 * Always on screen once the composer is, rather than surfacing only for the
 * ambiguous links it used to serve. Three reasons, all the same reason: a
 * control that appears out of nowhere pushes the form open under the cursor; a
 * control that is sometimes absent is a control the user does not know exists;
 * and a link the URL can only read one way still deserves to *say* which way,
 * rather than deciding in silence. So the switch stays put and the segment the
 * link cannot honour goes flat.
 */
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
  // A plain video has no set to fetch; a playlist URL has no one track to pick.
  // Both stay visible and inert; only a mixed link (a video opened from inside
  // a playlist) is a real question, and there the user's answer decides.
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
