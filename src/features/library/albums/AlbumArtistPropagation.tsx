import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { ArtistPropagation } from "@/features/library/albums/albumFields";
import { EDIT_ASIDE_CARD } from "@/features/library/albums/editAside";
import type { LibraryTrack } from "@/features/library/api";
import { HERO_PILL_SECONDARY } from "@/features/library/heroPill";

/**
 * The stage-4 assist: when a row's artist changes from OLD → NEW, the other rows
 * still at OLD are offered here — as a *checklist*, never a blanket apply. OLD is
 * often legitimately correct on some of them (the album's non-featuring tracks),
 * so the user ticks exactly which ones inherit the change. Everything applied
 * folds into the same draft, so it still ships as one save.
 */
function PropagationCard({
  propagation,
  tracks,
  onApply,
}: {
  propagation: ArtistPropagation;
  tracks: LibraryTrack[];
  onApply: (ids: number[], artist: string) => void;
}) {
  const { t } = useTranslation("library");
  const byId = useMemo(() => new Map(tracks.map((track) => [track.id, track])), [tracks]);
  // Default every candidate ticked: the frequent case is a correction meant for
  // all of them, and unticking the exceptions is one click.
  const [selected, setSelected] = useState<Set<number>>(() => new Set(propagation.candidateIds));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={EDIT_ASIDE_CARD}>
      <p className="text-[0.625rem] font-semibold tracking-wider text-accent uppercase">
        {t("metadata.fields.artist")}
      </p>
      <p className="text-[0.8125rem] leading-snug text-foreground">
        {t("albumMetadata.propagate.prompt", { from: propagation.from, to: propagation.to })}
      </p>

      <ul className="flex flex-col gap-1.5">
        {propagation.candidateIds.map((id) => {
          const track = byId.get(id);
          return (
            <li key={id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-[0.8125rem]">
                <input
                  type="checkbox"
                  checked={selected.has(id)}
                  onChange={() => toggle(id)}
                  className="size-4 shrink-0 accent-accent"
                />
                <span className="w-5 shrink-0 text-right tabular-nums text-muted/70">{track?.track ?? ""}</span>
                <span className="truncate text-foreground">{track?.title}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => onApply([...selected], propagation.to)}
          className={`${HERO_PILL_SECONDARY} cursor-pointer disabled:cursor-default disabled:opacity-50`}
        >
          {t("albumMetadata.propagate.apply", { count: selected.size })}
        </button>
      </div>
    </div>
  );
}

export function AlbumArtistPropagation({
  propagations,
  tracks,
  onApply,
}: {
  propagations: ArtistPropagation[];
  tracks: LibraryTrack[];
  onApply: (ids: number[], artist: string) => void;
}) {
  if (propagations.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {propagations.map((propagation) => (
        // Keyed by the rename and its candidate set, so applying part of it
        <PropagationCard
          key={`${propagation.from}\u0000${propagation.to}\u0000${propagation.candidateIds.join(",")}`}
          propagation={propagation}
          tracks={tracks}
          onApply={onApply}
        />
      ))}
    </div>
  );
}
