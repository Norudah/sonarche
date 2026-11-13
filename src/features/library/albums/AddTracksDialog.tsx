import { Button } from "@heroui/react";
import { Check, FolderInput, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { moveInto, proposeCollection } from "@/features/library/albums/move";
import { useMoveWithUndo } from "@/features/library/albums/useMoveWithUndo";
import type { LibraryTrack, MoveSpec } from "@/features/library/api";
import { useLibrary } from "@/features/library/hooks";
import { filterTracks } from "@/features/library/tracks/filter";
import { formatDuration } from "@/shared/lib/format";
import { Dialog } from "@/shared/ui/Dialog";

/** Search-driven: the list stops here and says so. */
const MAX_ROWS = 60;

interface AddTracksDialogProps {
  /** Null when closed. */
  album: Album | null;
  onClose: () => void;
}

function CandidateRow({ track, checked, onToggle }: { track: LibraryTrack; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group/row flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors hover:bg-default/50 focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        aria-hidden
        className={
          "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors " +
          (checked ? "border-accent bg-accent-fill text-accent-foreground" : "border-separator bg-transparent")
        }
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{track.title}</span>
        <span className="block truncate text-[0.75rem] text-muted">
          {track.artist}
          {track.album ? ` · ${track.album}` : ""}
        </span>
      </span>
      {track.length != null && (
        <span className="shrink-0 text-[0.75rem] text-muted tabular-nums">{formatDuration(track.length)}</span>
      )}
    </button>
  );
}

/** Mounted per opening so search and selection start clean. */
function PickerBody({ album, onClose }: { album: Album; onClose: () => void }) {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const { run, isPending } = useMoveWithUndo();
  const [query, setQuery] = useState("");
  // A Map: insertion order is the selection order, which numbers the tracks.
  const [picked, setPicked] = useState<Map<number, LibraryTrack>>(new Map());
  const [asCollection, setAsCollection] = useState<boolean | null>(null);

  const candidates = useMemo(() => {
    const residents = new Set(album.tracks.map((track) => track.id));
    return filterTracks(
      (library.data ?? []).filter((track) => !residents.has(track.id)),
      query,
    );
  }, [library.data, album, query]);
  const overflow = Math.max(0, candidates.length - MAX_ROWS);

  const selection = [...picked.values()];
  const alreadyCollection = album.kind === "collection";
  // The proposal follows the selection until the user answers it.
  const proposed = selection.length > 0 && proposeCollection(selection, album);
  const collection = asCollection ?? proposed;

  const toggle = (track: LibraryTrack) => {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(track.id)) next.delete(track.id);
      else next.set(track.id, track);
      return next;
    });
  };

  const confirm = () => {
    if (selection.length === 0 || isPending) return;
    const into = moveInto(selection, album);
    if (!into) return;
    const willBeCollection = alreadyCollection || collection;
    const spec: MoveSpec = {
      itemIds: into.itemIds,
      targetAlbumId: into.targetAlbumId,
      ...(collection && !alreadyCollection ? { kind: "collection" as const } : {}),
      renumber: willBeCollection,
    };
    run(spec, selection, album.title, onClose);
  };

  return (
    <>
      <Dialog.Header
        title={t("move.addTracksTitle", { name: album.title })}
        subtitle={t("move.addTracksSubtitle")}
        close={{ label: t("metadata.close"), onPress: onClose }}
      />

      <div className="shrink-0 px-6 pb-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted/70" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("move.addTracksSearchPlaceholder")}
            className="h-9 w-full min-w-0 rounded-xl border border-separator bg-transparent pr-3 pl-8 text-[0.8125rem] outline-none placeholder:text-muted/70 focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>

      <Dialog.Body className="px-3.5 pb-3">
        {candidates.length === 0 ? (
          <p className="px-2.5 py-3 text-center text-[0.8125rem] text-muted">{t("move.addTracksEmpty")}</p>
        ) : (
          <>
            {candidates.slice(0, MAX_ROWS).map((track) => (
              <CandidateRow
                key={track.id}
                track={track}
                checked={picked.has(track.id)}
                onToggle={() => toggle(track)}
              />
            ))}
            {overflow > 0 && (
              <p className="px-2.5 pt-2 text-center text-[0.75rem] text-muted">
                {t("move.moreTracks", { count: overflow })}
              </p>
            )}
          </>
        )}
      </Dialog.Body>

      <footer className="shrink-0 border-t border-separator px-6 py-4">
        {!alreadyCollection && selection.length > 0 && (
          <label className="mb-2.5 flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              checked={collection}
              onChange={(event) => setAsCollection(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
            />
            <span className="min-w-0">
              <span className="block text-[0.8125rem] font-medium text-foreground">
                {t("move.asCollection", { name: album.title })}
              </span>
              <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-muted">
                {t("move.asCollectionHint")}
              </span>
            </span>
          </label>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[0.75rem] text-muted">
            {selection.length > 0 ? t("move.selectedCount", { count: selection.length }) : t("move.selectHint")}
          </p>
          <Button variant="primary" isDisabled={selection.length === 0 || isPending} onPress={confirm}>
            <FolderInput className="size-3.5" />
            {/* No count when nothing is selected. */}
            {selection.length > 0 ? t("move.confirm", { count: selection.length }) : t("move.confirmEmpty")}
          </Button>
        </div>
      </footer>
    </>
  );
}

/** Pulls tracks onto this record. Checkboxes for a batch; selection order
 * becomes the record's order. */
export function AddTracksDialog({ album, onClose }: AddTracksDialogProps) {
  return (
    <Dialog isOpen={album != null} onClose={onClose}>
      {album != null && <PickerBody album={album} onClose={onClose} />}
    </Dialog>
  );
}
