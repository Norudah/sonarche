import { Alert, Button, Card, Chip, InputGroup, ProgressBar } from "@heroui/react";
import { Download, Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";
import type { StagedTrack } from "@/features/download/api";
import {
  useDownloadProgress,
  useDownloadTrack,
  useImportTrack,
} from "@/features/download/hooks";
import { formatDuration } from "@/shared/lib/format";
import { PageContainer } from "@/shared/ui/PageContainer";

function StagedTrackCard({ track }: { track: StagedTrack }) {
  const { t } = useTranslation("download");
  const importTrack = useImportTrack();

  return (
    <Card className="p-5">
      <Card.Content className="flex items-center gap-4">
        {track.thumbnail && (
          <img
            src={track.thumbnail}
            alt=""
            className="h-16 w-16 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{track.title ?? t("unknownTitle")}</p>
          <p className="truncate text-sm text-muted">
            {track.artist ?? t("unknownArtist")}
            {track.duration != null && ` · ${formatDuration(track.duration)}`}
          </p>
        </div>
        {importTrack.isSuccess ? (
          <Chip color="success">{t("imported")}</Chip>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onPress={() => importTrack.mutate(track.path)}
            isDisabled={importTrack.isPending}
          >
            {importTrack.isPending ? t("importing") : t("import")}
          </Button>
        )}
      </Card.Content>
      {importTrack.isError && (
        <Card.Footer>
          <Alert status="danger" className="w-full">
            <Alert.Content>
              <Alert.Title>{t("importFailed")}</Alert.Title>
              <Alert.Description>{String(importTrack.error)}</Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Footer>
      )}
      {importTrack.isSuccess && (
        <Card.Footer className="text-sm">
          <Link to={paths.library} className="text-accent underline-offset-4 hover:underline">
            {t("goToLibrary")}
          </Link>
        </Card.Footer>
      )}
    </Card>
  );
}

export function DownloadPage() {
  const { t } = useTranslation("download");
  const [url, setUrl] = useState("");
  const download = useDownloadTrack();
  const progress = useDownloadProgress(download.isPending);

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed || download.isPending) return;
    download.mutate(trimmed);
  };

  return (
    <PageContainer>
      <div className="relative -mx-8 -mt-8 overflow-hidden px-8 pt-10 pb-12">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-accent uppercase">
              {t("eyebrow")}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-balance whitespace-pre-line">
              {t("title")}
            </h1>
          </div>

          <form
            className="flex items-center gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <InputGroup.Root
              fullWidth
              className="rounded-xl focus-within:ring-2 focus-within:ring-accent/30"
            >
              <InputGroup.Prefix className="rounded-l-xl px-4 text-muted">
                <Link2 className="size-4" />
              </InputGroup.Prefix>
              <InputGroup.Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("urlPlaceholder")}
                aria-label={t("urlLabel")}
                className="py-3"
              />
            </InputGroup.Root>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="rounded-xl px-7"
              isDisabled={!url.trim() || download.isPending}
            >
              <Download className="size-4" />
              {download.isPending ? t("downloading") : t("download")}
            </Button>
          </form>
        </div>
      </div>

      {download.isPending && (
        <ProgressBar
          value={progress?.percent ?? 0}
          isIndeterminate={progress?.percent == null}
        >
          <ProgressBar.Track>
            <ProgressBar.Fill />
          </ProgressBar.Track>
        </ProgressBar>
      )}

      {download.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("downloadFailed")}</Alert.Title>
            <Alert.Description>{String(download.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      {download.isSuccess && (
        <StagedTrackCard key={download.data.path} track={download.data} />
      )}
    </PageContainer>
  );
}
