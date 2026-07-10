import { Alert, Button, Chip, Spinner } from "@heroui/react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { useLibrary } from "@/features/library/hooks";
import { formatDuration } from "@/shared/lib/format";

function TrackRow({ track }: { track: LibraryTrack }) {
  const { t } = useTranslation("library");
  return (
    <li className="flex items-center gap-4 rounded-xl px-3 py-2 transition-colors hover:bg-default/40">
      {track.artUrl ? (
        <img src={track.artUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-default/60 text-lg">
          ♪
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{track.title || t("unknownTitle")}</p>
        <p className="truncate text-sm text-muted-foreground">
          {track.artist || t("unknownArtist")}
          {track.album && ` — ${track.album}`}
          {track.year != null && ` (${track.year})`}
        </p>
      </div>
      <Chip color="default" size="sm" variant="soft">
        {track.format}
      </Chip>
      <span className="w-12 text-right text-sm tabular-nums text-muted-foreground">
        {track.length != null ? formatDuration(track.length) : "—"}
      </span>
    </li>
  );
}

export function LibraryPage() {
  const { t } = useTranslation("library");
  const library = useLibrary();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          {library.data && (
            <p className="mt-1 text-sm text-muted-foreground">
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
          <p className="text-muted-foreground">{t("empty")}</p>
          <Link to={paths.download} className="text-accent underline-offset-4 hover:underline">
            {t("goToDownload")}
          </Link>
        </div>
      )}

      {library.data && library.data.length > 0 && (
        <ul className="flex flex-col gap-1">
          {library.data.map((track) => (
            <TrackRow key={track.id} track={track} />
          ))}
        </ul>
      )}
    </div>
  );
}
