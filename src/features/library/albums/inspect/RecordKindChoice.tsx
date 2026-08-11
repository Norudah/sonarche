import { Radio, RadioGroup } from "@heroui/react";
import { Disc3, Library } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { AlbumKind } from "@/features/library/api";
import { layoutIds, springs } from "@/shared/motion/tokens";
import { FieldHelp } from "@/shared/ui/FieldHelp";

/* The composer's segmented control, verbatim — one pill sliding between two
 * segments already means "throw this switch" in this app. See `KindChoice` for
 * why the pill shape and the padding live on different elements. */
const SEGMENT = "relative mt-0 rounded-full";
const SEGMENT_CONTENT =
  "relative gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors " +
  "text-muted hover:text-foreground data-[selected]:text-accent";

function Segment({ kind, selected, children }: { kind: AlbumKind; selected: AlbumKind; children: ReactNode }) {
  return (
    <Radio.Root value={kind} className={SEGMENT}>
      {selected === kind && (
        <motion.span
          layoutId={layoutIds.recordKind}
          transition={springs.snappy}
          className="absolute inset-0 rounded-full bg-surface shadow-xs"
        />
      )}
      <Radio.Content className={SEGMENT_CONTENT}>{children}</Radio.Content>
    </Radio.Root>
  );
}

/**
 * What this record is, in its owner's words.
 *
 * The one control in this panel that is not a draft. Every field around it
 * accumulates into the footer's change count and lands on Save, because every
 * field around it is a tag written into N files. This is not a tag — it is how
 * Sonarche should read the record — so it applies on the spot and has nothing
 * to save.
 *
 * The consequence lives in the label's "?" rather than under the switch: the
 * two explanations printed in the column pushed it into scrolling, and the
 * notion only needs reading once. Both kinds are stated at once — a tooltip
 * whose text changed with the selection would read as a status, not a help.
 *
 * Absent for a group with no album row behind it — a pile of singletons has no
 * record to be a kind of.
 */
export function RecordKindChoice({
  kind,
  isPending,
  onChange,
}: {
  kind: AlbumKind;
  isPending: boolean;
  onChange: (kind: AlbumKind) => void;
}) {
  const { t } = useTranslation("library");

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <p className="text-[0.75rem] font-medium text-muted">{t("albumMetadata.kind.label")}</p>
        <FieldHelp
          label={t("metadata.help.open", { field: t("albumMetadata.kind.label") })}
          text={
            <>
              <p>
                <span className="font-semibold">{t("albumMetadata.kind.album")}</span> —{" "}
                {t("albumMetadata.kind.albumWhy")}
              </p>
              <p className="mt-1.5">
                <span className="font-semibold">{t("albumMetadata.kind.collection")}</span> —{" "}
                {t("albumMetadata.kind.collectionWhy")}
              </p>
            </>
          }
        />
      </div>

      <RadioGroup
        value={kind}
        isDisabled={isPending}
        onChange={(next) => onChange(next as AlbumKind)}
        aria-label={t("albumMetadata.kind.label")}
        className="flex w-fit flex-row gap-0.5 rounded-full bg-default/60 p-0.5"
      >
        <Segment kind="album" selected={kind}>
          <Disc3 className="size-3.5 shrink-0" />
          {t("albumMetadata.kind.album")}
        </Segment>
        <Segment kind="collection" selected={kind}>
          <Library className="size-3.5 shrink-0" />
          {t("albumMetadata.kind.collection")}
        </Segment>
      </RadioGroup>
    </div>
  );
}
