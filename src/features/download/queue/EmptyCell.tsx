import { useTranslation } from "react-i18next";

/**
 * Placeholder for a column that has nothing to report yet.
 *
 * It used to be an em-dash, which was a mistake in this table specifically: the
 * pipeline column is built out of small horizontal bars, so a row of dashes
 * read as pipeline segments that had failed to fill. A dot means the same
 * "nothing here" while sharing no shape with a bar.
 *
 * The fixed height matches a `size="sm"` Chip, the thing that replaces it once
 * the job completes, so the row does not resize when it lands.
 */
export function EmptyCell() {
  const { t } = useTranslation("download");
  return (
    <span className="flex h-6 items-center" role="note" aria-label={t("queue.awaiting")}>
      <span className="size-1.5 rounded-full bg-muted/40" />
    </span>
  );
}
