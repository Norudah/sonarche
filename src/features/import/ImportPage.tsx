import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { pickFolder, type ScanReport, scanImportFolder } from "@/features/import/api";
import { FolderCard } from "@/features/import/FolderCard";
import { useImportProgress, useLibraryImport } from "@/features/import/hooks";
import { importPhase } from "@/features/import/phase";
import { PageContainer } from "@/shared/ui/PageContainer";

export function ImportPage() {
  const { t } = useTranslation("import");
  const [folder, setFolder] = useState<string | null>(null);

  // A mutation rather than a query: the scan is started by an act of the user's
  // and its result belongs to that one choice — there is no key to cache it
  // under, and nothing should re-fetch it in the background.
  const scan = useMutation<ScanReport, unknown, string>({ mutationFn: scanImportFolder });
  const run = useLibraryImport();
  const progress = useImportProgress(run.isPending);

  const choose = async () => {
    const chosen = await pickFolder();
    // Closing the panel is an answer: keep whatever was already on screen.
    if (chosen == null) return;
    setFolder(chosen);
    // A new folder makes the last import's verdict about someone else.
    run.reset();
    scan.mutate(chosen);
  };

  const phase = importPhase({
    folder,
    scanning: scan.isPending,
    scanError: scan.isError ? String(scan.error) : null,
    report: scan.data ?? null,
    importing: run.isPending,
    importError: run.isError ? String(run.error) : null,
    outcome: run.data ?? null,
  });

  return (
    <PageContainer>
      {/* The same accent wash as the download page's composer — the two are the
          only ways music gets into the ark, and they should read as one family. */}
      <div className="relative -mx-8 -mt-8 overflow-hidden px-8 pt-10 pb-6">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent-soft/80 via-accent-soft/25 to-background" />

        <div className="relative flex flex-col gap-5">
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("eyebrow")}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{t("title")}</h1>
          </div>

          <FolderCard
            folder={folder}
            phase={phase}
            progress={progress}
            onChoose={() => void choose()}
            onStart={() => folder != null && run.mutate(folder)}
          />
        </div>
      </div>
    </PageContainer>
  );
}
