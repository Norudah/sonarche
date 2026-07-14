import { Alert, Button, InputGroup } from "@heroui/react";
import { Download, Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { QueueTable } from "@/features/download/QueueTable";
import { useActiveDownloadProgress, useEnqueueDownload, useJobs } from "@/features/download/hooks";
import { PageContainer } from "@/shared/ui/PageContainer";

export function DownloadPage() {
  const { t } = useTranslation("download");
  const [url, setUrl] = useState("");
  const jobs = useJobs();
  const enqueue = useEnqueueDownload();

  const hasActiveDownload = jobs.data?.some((job) => job.status === "downloading") ?? false;
  const downloadPercent = useActiveDownloadProgress(hasActiveDownload);

  const submit = () => {
    const trimmed = url.trim();
    if (!trimmed || enqueue.isPending) return;
    enqueue.mutate(trimmed, { onSuccess: () => setUrl("") });
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
              isDisabled={!url.trim() || enqueue.isPending}
            >
              <Download className="size-4" />
              {t("download")}
            </Button>
          </form>
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
        <h2 className="text-lg font-semibold">{t("queue.heading")}</h2>
        <QueueTable jobs={jobs.data ?? []} downloadPercent={downloadPercent} />
      </section>
    </PageContainer>
  );
}
