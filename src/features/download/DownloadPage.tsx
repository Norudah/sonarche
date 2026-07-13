import {
  Alert,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ProgressBar,
  TextField,
} from "@heroui/react";
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
      </div>

      <form
        className="flex items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <TextField value={url} onChange={setUrl} fullWidth>
          <Label>{t("urlLabel")}</Label>
          <Input placeholder="https://www.youtube.com/watch?v=…" />
        </TextField>
        <Button type="submit" variant="primary" isDisabled={!url.trim() || download.isPending}>
          {download.isPending ? t("downloading") : t("download")}
        </Button>
      </form>

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
