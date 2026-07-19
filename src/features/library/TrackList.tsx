import { Button, Chip } from "@heroui/react";
import { FileText, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { LibraryTrack } from "@/features/library/api";
import { DeleteTrackDialog } from "@/features/library/DeleteTrackDialog";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";

function TrackRow({
  track,
  onInspect,
  onDelete,
}: {
  track: LibraryTrack;
  onInspect: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("library");
  const { t: tPlayer } = useTranslation("player");
  const { current, isPlaying, play } = usePlayer();
  const isCurrent = current?.id === track.id;

  return (
    <li
      className={
        "flex items-center gap-4 rounded-xl px-3 py-2 transition-colors hover:bg-default/40" +
        (isCurrent ? " bg-accent/15" : "")
      }
    >
      <Button
        variant="secondary"
        size="sm"
        onPress={() =>
          play({
            id: track.id,
            src: track.audioUrl,
            title: track.title || t("unknownTitle"),
            subtitle: track.artist || t("unknownArtist"),
            artUrl: track.artUrl,
            duration: track.length,
          })
        }
        aria-label={isCurrent && isPlaying ? tPlayer("pause") : tPlayer("play")}
      >
        {isCurrent && isPlaying ? "⏸" : "▶"}
      </Button>
      {track.artUrl ? (
        <img src={track.artUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-default/60 text-lg">
          ♪
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{track.title || t("unknownTitle")}</p>
        <p className="truncate text-sm text-muted">
          {track.artist || t("unknownArtist")}
          {track.album && ` — ${track.album}`}
          {track.year != null && ` (${track.year})`}
        </p>
      </div>
      <Chip color="default" size="sm" variant="soft">
        {track.format}
      </Chip>
      <span className="w-12 text-right text-sm tabular-nums text-muted">
        {track.length != null ? formatDuration(track.length) : "—"}
      </span>
      <Button
        variant="tertiary"
        size="sm"
        isIconOnly
        onPress={onInspect}
        aria-label={t("metadata.inspect")}
      >
        <FileText className="size-4" />
      </Button>
      <Button
        variant="tertiary"
        size="sm"
        isIconOnly
        onPress={onDelete}
        aria-label={t("delete.action")}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}

export function TrackList({ tracks }: { tracks: LibraryTrack[] }) {
  const [inspectedId, setInspectedId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<LibraryTrack | null>(null);

  // Derive from the live list, not a snapshot: re-enrich mutates the track and
  // the drawer must show the new album/artwork after the query refetches.
  const inspected = inspectedId != null ? (tracks.find((t) => t.id === inspectedId) ?? null) : null;

  return (
    <>
      <ul className="flex flex-col gap-1">
        {tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            onInspect={() => setInspectedId(track.id)}
            onDelete={() => setDeleting(track)}
          />
        ))}
      </ul>

      <MetadataDrawer
        track={inspected}
        onClose={() => setInspectedId(null)}
        onDelete={setDeleting}
      />
      <DeleteTrackDialog track={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
