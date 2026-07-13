import { Alert, Button, Chip, Spinner } from "@heroui/react";
import { FileText } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { useLibrary } from "@/features/library/hooks";
import { MetadataDrawer } from "@/features/library/MetadataDrawer";
import { formatDuration } from "@/shared/lib/format";
import { usePlayer } from "@/shared/player/PlayerContext";
import { PageContainer } from "@/shared/ui/PageContainer";

function TrackRow({ track, onInspect }: { track: LibraryTrack; onInspect: () => void }) {
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
    </li>
  );
}

export function TracksView() {
  const { t } = useTranslation("library");
  const library = useLibrary();
  const [inspected, setInspected] = useState<LibraryTrack | null>(null);

  return (
    <PageContainer>
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("views.tracks")}</h1>
          {library.data && (
            <p className="mt-1 text-sm text-muted">
              {t("trackCount", { count: library.data.length })}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onPress={() => library.refetch()}
          isDisabled={library.isFetching}
        >
          {t("refresh")}
        </Button>
      </div>

      {library.isPending && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {library.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("loadFailed")}</Alert.Title>
            <Alert.Description>{String(library.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {library.data && library.data.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-4xl">♪</p>
          <p className="text-muted">{t("empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {library.data && library.data.length > 0 && (
        <ul className="flex flex-col gap-1">
          {library.data.map((track) => (
            <TrackRow key={track.id} track={track} onInspect={() => setInspected(track)} />
          ))}
        </ul>
      )}

      <MetadataDrawer track={inspected} onClose={() => setInspected(null)} />
    </PageContainer>
  );
}
