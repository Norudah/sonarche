import { Spinner } from "@heroui/react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { CoverCandidate } from "@/features/library/api";

/**
 * What the Cover Art Archive holds for this album — the way back to an
 * official cover after a personal one, or to another edition's art. The lookup
 * only runs when asked: the strip rests as a button, and opening the modal
 * costs no network. Thumbnails arrive as data URLs from the sidecar; picking
 * one only *selects* it, the full-size download happens on confirm.
 */
export function CandidateStrip({
  hasSearched,
  candidates,
  isLoading,
  isError,
  selectedId,
  onSearch,
  onSelect,
  onRetry,
}: {
  /** Whether the user asked for the lookup — before that, the strip is a button. */
  hasSearched: boolean;
  candidates: CoverCandidate[] | undefined;
  isLoading: boolean;
  isError: boolean;
  selectedId: string | null;
  onSearch: () => void;
  onSelect: (candidate: CoverCandidate) => void;
  onRetry: () => void;
}) {
  const { t } = useTranslation("library");

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
          {t("albumMetadata.cover.candidates.heading")}
        </h3>
        <span className="text-[0.6875rem] text-muted/70">{t("albumMetadata.cover.candidates.hint")}</span>
      </div>

      {!hasSearched ? (
        <div className="flex h-20 items-center">
          <button
            type="button"
            onClick={onSearch}
            className="flex cursor-pointer items-center gap-2 rounded-full border border-separator px-3.5 py-1.5 text-[0.8125rem] font-medium text-foreground outline-none transition-colors hover:bg-default/60 focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <Search className="size-3.5" />
            {t("albumMetadata.cover.candidates.search")}
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex h-20 items-center gap-2 text-[0.75rem] text-muted">
          <Spinner size="sm" />
          {t("albumMetadata.cover.candidates.loading")}
        </div>
      ) : isError ? (
        <div className="flex h-20 items-center gap-3 text-[0.75rem] text-muted">
          {t("albumMetadata.cover.candidates.failed")}
          <button
            type="button"
            onClick={onRetry}
            className="cursor-pointer rounded-full border border-separator px-2.5 py-1 font-medium text-foreground outline-none transition-colors hover:bg-default/60 focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            {t("albumMetadata.cover.candidates.retry")}
          </button>
        </div>
      ) : !candidates || candidates.length === 0 ? (
        <p className="flex h-20 items-center text-[0.75rem] text-muted">{t("albumMetadata.cover.candidates.empty")}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {candidates.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              onClick={() => onSelect(candidate)}
              title={candidate.types.join(", ")}
              aria-pressed={selectedId === candidate.id}
              className={`relative size-20 shrink-0 cursor-pointer overflow-hidden rounded-lg outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-accent/60 ${
                selectedId === candidate.id ? "ring-2 ring-accent" : "ring-1 ring-artwork-edge hover:ring-accent/50"
              }`}
            >
              <img src={candidate.thumb} alt="" className="size-full object-cover" />
              {candidate.front && (
                <span className="absolute right-1 bottom-1 rounded-full bg-black/60 px-1.5 py-px text-[0.5625rem] font-medium text-white">
                  {t("albumMetadata.cover.candidates.front")}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
