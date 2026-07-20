import { useTranslation } from "react-i18next";

import type { SubGenre } from "@/features/library/genres/genres";

interface SubGenreChipsProps {
  subs: SubGenre[];
  /** null = no narrowing, the whole family. */
  selected: string | null;
  onSelect: (genre: string | null) => void;
}

/**
 * The family's specific genres, as a filter rather than as navigation.
 *
 * They are buttons, not links, and that is the point: in the mockup this
 * started life as chips printed on a card that was itself a link, so the chip
 * and the card were two targets with no visible boundary. A sub-genre has no
 * page of its own — it narrows the shelf below and nothing else — so it must
 * not look like something you can go *to*.
 */
export function SubGenreChips({ subs, selected, onSelect }: SubGenreChipsProps) {
  const { t } = useTranslation("library");

  if (subs.length === 0) return null;

  const chip = (isActive: boolean) =>
    "cursor-pointer rounded-full px-3 py-1 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
    (isActive
      ? "bg-accent text-accent-foreground"
      : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => onSelect(null)} className={chip(selected == null)}>
        {t("genres.allSubs")}
      </button>
      {subs.map((sub) => (
        <button
          key={sub.name}
          type="button"
          onClick={() => onSelect(selected === sub.name ? null : sub.name)}
          className={chip(selected === sub.name)}
        >
          {sub.name}
          <span className="ml-1.5 tabular-nums opacity-60">{sub.trackCount}</span>
        </button>
      ))}
    </div>
  );
}
