import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";

/** Pending changes, in the title bar where its changing width moves nothing. */
export function PendingBadge({
  fields,
  tracks,
}: {
  fields: number;
  /** Omitted at one track's scale. */ tracks?: number;
}) {
  const { t } = useTranslation("library");

  return (
    <AnimatePresence>
      {fields > 0 && (
        <motion.span
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={springs.snappy}
          className="flex shrink-0 items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[0.75rem] font-medium text-accent"
        >
          <span className="size-1.5 rounded-full bg-accent" />
          {t("albumMetadata.changes.fields", { count: fields })}
          {tracks != null && <span className="opacity-70">{t("albumMetadata.changes.tracks", { count: tracks })}</span>}
        </motion.span>
      )}
    </AnimatePresence>
  );
}
