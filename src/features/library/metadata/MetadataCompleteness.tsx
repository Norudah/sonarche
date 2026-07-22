import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { COMPLETENESS_KEYS } from "@/features/library/metadata/fields";
import { springs } from "@/shared/motion/tokens";

/** One dot per tracked field, filled left to right. Same colour language as the
 * album tracklist's tag-status dot: amber while a field is missing (the reserved
 * "incomplete metadata" hue), green once the record is whole. The label matches
 * the sidebar's section captions — a signpost to be found when looked for, not
 * read on the way past.
 *
 * The dots pop in one after another, left to right, when the panel opens: the
 * count is the one number the app is about, so it announces itself rather than
 * being already there. */
export function MetadataCompleteness({ filled }: { filled: number }) {
  const { t } = useTranslation("library");
  const total = COMPLETENESS_KEYS.length;
  const isComplete = filled === total;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-[10px] font-semibold tracking-widest text-muted/70 uppercase">
        {t("metadata.completeness", { filled, total })}
      </p>
      <div className="flex shrink-0 gap-1.5">
        {Array.from({ length: total }, (_, index) => (
          <motion.span
            key={index}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ ...springs.bouncy, delay: index * 0.05 }}
            className={
              "size-2 rounded-full " + (index < filled ? (isComplete ? "bg-success" : "bg-warning") : "bg-default")
            }
          />
        ))}
      </div>
    </div>
  );
}
