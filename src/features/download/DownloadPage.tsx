import { Alert, Button, Chip, InputGroup } from "@heroui/react";
import { Disc3, Download, Link2, Music, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import { ClearHistoryDialog } from "@/features/download/ClearHistoryDialog";
import { QueueTable } from "@/features/download/QueueTable";
import {
  useActiveDownloadProgress,
  useEnqueueDownload,
  useEnrichProgress,
  useJobs,
} from "@/features/download/hooks";
import { detectUrlKind } from "@/features/download/urlKind";
import { PageContainer } from "@/shared/ui/PageContainer";

export function DownloadPage() {
  const { t } = useTranslation("download");
  const [url, setUrl] = useState("");
  // The mixed-URL choice is bound to the URL it was made for: editing the
  // input invalidates it, no effect needed.
  const [mixedChoice, setMixedChoice] = useState<{ url: string; kind: JobKind } | null>(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const jobs = useJobs();
  const enqueue = useEnqueueDownload();

  const hasHistory = jobs.data?.some((job) => job.status === "done" || job.status === "failed") ?? false;

  const hasActiveDownload = jobs.data?.some((job) => job.status === "downloading") ?? false;
  const downloadPercent = useActiveDownloadProgress(hasActiveDownload);

  const hasActiveEnrich = jobs.data?.some((job) => job.status === "enriching") ?? false;
  const enrichStages = useEnrichProgress(hasActiveEnrich);

  const detected = detectUrlKind(url);
  const chosenKind = mixedChoice?.url === url ? mixedChoice.kind : null;
  const kind: JobKind | null =
    detected === "album" ? "album" : detected === "mixed" ? chosenKind : "single";

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed || kind == null || enqueue.isPending) return;
    enqueue.mutate(
      { url: trimmed, kind },
      {
        onSuccess: () => {
          setUrl("");
          setMixedChoice(null);
        },
      },
    );
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
              isDisabled={!url.trim() || kind == null || enqueue.isPending}
            >
              <Download className="size-4" />
              {t("download")}
            </Button>
          </form>

          {detected === "single" && (
            <Chip variant="soft" size="sm" className="self-start">
              <Music className="size-3.5" />
              {t("detected.single")}
            </Chip>
          )}
          {detected === "album" && (
            <Chip variant="soft" size="sm" color="accent" className="self-start">
              <Disc3 className="size-3.5" />
              {t("detected.album")}
            </Chip>
          )}
          {detected === "mixed" && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted">{t("detected.mixed")}</p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={chosenKind === "single" ? "primary" : "secondary"}
                  aria-pressed={chosenKind === "single"}
                  onPress={() => setMixedChoice({ url, kind: "single" })}
                >
                  <Music className="size-4" />
                  {t("detected.choiceTrack")}
                </Button>
                <Button
                  size="sm"
                  variant={chosenKind === "album" ? "primary" : "secondary"}
                  aria-pressed={chosenKind === "album"}
                  onPress={() => setMixedChoice({ url, kind: "album" })}
                >
                  <Disc3 className="size-4" />
                  {t("detected.choicePlaylist")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {enqueue.isError && (
        <Alert status="danger">
          <Alert.Content>
            <Alert.Title>{t("enqueueFailed")}</Alert.Title>
            <Alert.Description>{String(enqueue.error)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("queue.heading")}</h2>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => setClearingHistory(true)}
            isDisabled={!hasHistory}
          >
            <Trash2 className="size-4" />
            {t("queue.clearHistory")}
          </Button>
        </div>
        <QueueTable
          jobs={jobs.data ?? []}
          downloadPercent={downloadPercent}
          enrichStages={enrichStages}
        />
      </section>

      <ClearHistoryDialog isOpen={clearingHistory} onClose={() => setClearingHistory(false)} />
    </PageContainer>
  );
}
