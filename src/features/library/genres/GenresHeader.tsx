import { Button } from "@heroui/react";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { ScopeToggle, type GenreScope } from "@/features/library/genres/ScopeToggle";
import { SearchField } from "@/features/library/tracks/SearchField";
import { Swap } from "@/shared/motion/Swap";

interface GenresHeaderProps {
  scope: GenreScope;
  onScopeChange: (value: GenreScope) => void;
  familyCount: number;
  genreCount: number;
  unclassifiedCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  /** Recompute is a library-wide write, so it belongs to the page, not to a row. */
  isRecomputing: boolean;
  onRecompute: () => void;
  /** Result of the last recompute, already translated, or null. */
  feedback: { text: string; tone: string } | null;
}

/**
 * No sort control, unlike the album and artist shelves. Rows are ordered by
 * size and that ordering *is* the page — letting the user sort them A→Z would
 * turn the distribution back into the flat list it exists not to be. The one
 * control that belongs here changes the unit, not the order.
 */
export function GenresHeader({
  scope,
  onScopeChange,
  familyCount,
  genreCount,
  unclassifiedCount,
  query,
  onQueryChange,
  isRecomputing,
  onRecompute,
  feedback,
}: GenresHeaderProps) {
  const { t } = useTranslation("library");

  const meta = [
    t("genres.familyCount", { count: familyCount }),
    t("genres.genreCount", { count: genreCount }),
    unclassifiedCount > 0 ? t("genres.unclassifiedCount", { count: unclassifiedCount }) : null,
  ].filter(Boolean);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("views.genres")}</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted">{meta.join(" · ")}</p>
        {feedback && (
          <Swap swapKey={feedback.text}>
            <span className={`mt-1 block text-[0.8125rem] ${feedback.tone}`}>{feedback.text}</span>
          </Swap>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ScopeToggle value={scope} onChange={onScopeChange} />
        <SearchField value={query} onChange={onQueryChange} />
        <Button
          variant="secondary"
          size="sm"
          className="h-9 rounded-full"
          isDisabled={isRecomputing}
          onPress={onRecompute}
        >
          {isRecomputing ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {t("genres.recomputing")}
            </>
          ) : (
            <>
              <RefreshCw className="size-4" />
              {t("genres.recompute")}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
