import { Modal } from "@heroui/react";
import { ChevronLeft, FolderInput, Library, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { filterAlbums, groupAlbums, sortAlbums, type Album } from "@/features/library/albums/albums";
import { AlbumCover } from "@/features/library/albums/AlbumCover";
import { alreadyOn, moveInto, proposeCollection, suggestedArtist } from "@/features/library/albums/move";
import { useMoveWithUndo } from "@/features/library/albums/useMoveWithUndo";
import type { LibraryTrack, MoveSpec } from "@/features/library/api";
import { useLibrary } from "@/features/library/hooks";

/** Beyond this the list stops growing and asks for a narrower search: a picker
 * is search-driven, and thousands of rows would be paid for by every keystroke. */
const MAX_ROWS = 50;

const INPUT =
  "min-w-0 flex-1 rounded-xl border border-separator bg-transparent px-3 py-1.5 text-[0.8125rem] outline-none placeholder:text-muted/70 focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/30";

interface MoveToAlbumDialogProps {
  /** What is being refiled — one row's track, or a whole record. Null = closed. */
  tracks: LibraryTrack[] | null;
  onClose: () => void;
}

function AlbumRow({ album, disabled, onPick }: { album: Album; disabled: boolean; onPick: () => void }) {
  const { t } = useTranslation("library");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className="group/row flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors hover:bg-default/40 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:hover:bg-transparent"
    >
      <AlbumCover artUrl={album.artUrl} loading="lazy" className="size-10 shrink-0 rounded-md" />
      <span className="min-w-0 flex-1">
        <span className={"block truncate text-sm font-medium " + (disabled ? "text-muted" : "text-foreground")}>
          {album.title}
        </span>
        <span className="block truncate text-[0.75rem] text-muted">
          {album.artist} · {t("trackCount", { count: album.tracks.length })}
        </span>
      </span>
      {disabled && <span className="shrink-0 text-[0.75rem] text-muted">{t("move.alreadyThere")}</span>}
    </button>
  );
}

/** Step 2a — the picked record, what will happen, and the nature choice. */
function ConfirmStep({
  tracks,
  target,
  onBack,
  onClose,
}: {
  tracks: LibraryTrack[];
  target: Album;
  onBack: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("library");
  const { run, isPending } = useMoveWithUndo();
  // Pre-answered by what the tracks themselves say: arrivals from another
  // record make a personal gathering, same-tag arrivals are a repair.
  const [asCollection, setAsCollection] = useState(() => proposeCollection(tracks, target));
  const alreadyCollection = target.kind === "collection";

  const confirm = () => {
    const into = moveInto(tracks, target);
    if (!into) return;
    const willBeCollection = alreadyCollection || asCollection;
    const spec: MoveSpec = {
      itemIds: into.itemIds,
      targetAlbumId: into.targetAlbumId,
      ...(asCollection && !alreadyCollection ? { kind: "collection" as const } : {}),
      renumber: willBeCollection,
    };
    run(spec, tracks, target.title, onClose);
  };

  return (
    <div className="flex flex-col px-6 pb-5">
      <div className="flex items-center gap-3 rounded-xl bg-default/40 p-3">
        <AlbumCover artUrl={target.artUrl} className="size-12 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{target.title}</p>
          <p className="truncate text-[0.75rem] text-muted">{target.artist}</p>
        </div>
      </div>

      <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
        {t("move.confirmBody", { count: tracks.length, name: target.title })}
      </p>

      {alreadyCollection ? (
        <p className="mt-2 text-[0.8125rem] leading-relaxed text-muted">
          {t("move.alreadyCollection", { name: target.title })}
        </p>
      ) : (
        <label className="mt-3 flex cursor-pointer items-start gap-2.5">
          <input
            type="checkbox"
            checked={asCollection}
            onChange={(event) => setAsCollection(event.target.checked)}
            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-accent"
          />
          <span className="min-w-0">
            <span className="block text-[0.8125rem] font-medium text-foreground">
              {t("move.asCollection", { name: target.title })}
            </span>
            <span className="mt-0.5 block text-[0.75rem] leading-relaxed text-muted">{t("move.asCollectionHint")}</span>
          </span>
        </label>
      )}

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-[0.8125rem] text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ChevronLeft className="size-3.5" />
          {t("back")}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={confirm}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
        >
          <FolderInput className="size-3.5" />
          {t("move.confirm", { count: tracks.length })}
        </button>
      </div>
    </div>
  );
}

/** Step 2b — name a record that does not exist yet. Always born a collection:
 * a selection gathered by hand is the definition of one. */
function CreateStep({ tracks, onBack, onClose }: { tracks: LibraryTrack[]; onBack: () => void; onClose: () => void }) {
  const { t } = useTranslation("library");
  const { run, isPending } = useMoveWithUndo();
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState(() => suggestedArtist(tracks));
  const ready = title.trim() !== "" && artist.trim() !== "";

  const create = () => {
    if (!ready || isPending) return;
    const spec: MoveSpec = {
      itemIds: tracks.map((track) => track.id),
      newAlbum: { album: title.trim(), albumartist: artist.trim() },
      kind: "collection",
      renumber: true,
    };
    run(spec, tracks, title.trim(), onClose);
  };

  return (
    <form
      className="flex flex-col px-6 pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        create();
      }}
    >
      <div className="flex flex-col gap-2">
        {/* Autofocused on purpose: this step exists to type a name. */}
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("move.newTitlePlaceholder")}
          maxLength={120}
          autoFocus
          className={INPUT}
        />
        <input
          type="text"
          value={artist}
          onChange={(event) => setArtist(event.target.value)}
          placeholder={t("move.newArtistPlaceholder")}
          maxLength={120}
          className={INPUT}
        />
      </div>
      <p className="mt-2 text-[0.75rem] leading-relaxed text-muted">{t("move.newHint")}</p>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 rounded-xl px-2.5 py-1.5 text-[0.8125rem] text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <ChevronLeft className="size-3.5" />
          {t("back")}
        </button>
        <button
          type="submit"
          disabled={!ready || isPending}
          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
        >
          <Plus className="size-3.5" />
          {t("move.createConfirm", { count: tracks.length })}
        </button>
      </div>
    </form>
  );
}

/** Mounted per opening so search, step and drafts start clean each time. */
function PickerBody({ tracks, onClose }: { tracks: LibraryTrack[]; onClose: () => void }) {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<{ kind: "pick" } | { kind: "confirm"; target: Album } | { kind: "create" }>({
    kind: "pick",
  });

  const albums = useMemo(() => {
    const cards = groupAlbums(library.data ?? []).filter((album) => album.albumIds.length > 0);
    return sortAlbums(filterAlbums(cards, query), "artist");
  }, [library.data, query]);
  const overflow = Math.max(0, albums.length - MAX_ROWS);

  return (
    <div className="flex max-h-[inherit] flex-col">
      <header className="flex shrink-0 items-start gap-3 px-6 pt-5 pb-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
            {step.kind === "create" ? t("move.newCollection") : t("move.title")}
          </h2>
          <p className="mt-0.5 truncate text-[0.75rem] text-muted">{t("trackCount", { count: tracks.length })}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("metadata.close")}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-default/60 text-muted outline-none transition-colors hover:bg-default hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {step.kind === "confirm" && (
        <ConfirmStep tracks={tracks} target={step.target} onBack={() => setStep({ kind: "pick" })} onClose={onClose} />
      )}
      {step.kind === "create" && (
        <CreateStep tracks={tracks} onBack={() => setStep({ kind: "pick" })} onClose={onClose} />
      )}
      {step.kind === "pick" && (
        <>
          <div className="shrink-0 px-6 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted/70" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("move.searchPlaceholder")}
                className={`${INPUT} w-full pl-8`}
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3.5 pb-4">
            <button
              type="button"
              onClick={() => setStep({ kind: "create" })}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none transition-colors hover:bg-default/40 focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-separator text-muted">
                <Library className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{t("move.newCollection")}</span>
                <span className="block truncate text-[0.75rem] text-muted">{t("move.newCollectionHint")}</span>
              </span>
              <Plus className="size-4 shrink-0 text-muted" />
            </button>

            {albums.length === 0 ? (
              <p className="px-2.5 py-3 text-center text-[0.8125rem] text-muted">{t("move.pickerEmpty")}</p>
            ) : (
              <>
                {albums.slice(0, MAX_ROWS).map((album) => (
                  <AlbumRow
                    key={album.key}
                    album={album}
                    disabled={alreadyOn(tracks, album)}
                    onPick={() => setStep({ kind: "confirm", target: album })}
                  />
                ))}
                {overflow > 0 && (
                  <p className="px-2.5 pt-2 text-center text-[0.75rem] text-muted">
                    {t("move.moreResults", { count: overflow })}
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * "Déplacer vers un album" — the push half of refiling. A picker first, like
 * the playlist one it mirrors, but with a confirm step: this gesture moves
 * files on disk, and a record's nature may change with it, so the click that
 * commits states both.
 */
export function MoveToAlbumDialog({ tracks, onClose }: MoveToAlbumDialogProps) {
  return (
    <Modal
      isOpen={tracks != null}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="max-h-[80vh] w-[28rem] max-w-[95vw] rounded-2xl p-0!">
            {tracks != null && <PickerBody tracks={tracks} onClose={onClose} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
