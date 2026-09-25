import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { pickFolder, type Grouping, type ScanReport, scanImportFolder } from "@/features/import/api";
import { FolderPicker } from "@/features/import/FolderPicker";
import { suggestGrouping } from "@/features/import/grouping";
import { HowItWorks } from "@/features/import/HowItWorks";
import { LastImportSection } from "@/features/import/LastImportSection";
import { useCancelImport, useImportProgress, useLibraryImport } from "@/features/import/hooks";
import { ImportCard } from "@/features/import/ImportCard";
import { importPhase } from "@/features/import/phase";
import { PageContainer } from "@/shared/ui/PageContainer";

/** `children` is a tail slot the app layer fills with the alignment section
 * (a library-feature module this feature can't import). */
export function ImportPage({ children }: { children?: ReactNode }) {
  const { t } = useTranslation("import");
  const [folder, setFolder] = useState<string | null>(null);
  // Null until the user overrides the suggestion, which is derived from the scan.
  const [chosenGrouping, setChosenGrouping] = useState<Grouping | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  // A mutation: user-triggered, tied to one choice, never refetched.
  const scan = useMutation<ScanReport, unknown, string>({ mutationFn: scanImportFolder });
  const run = useLibraryImport();
  const cancel = useCancelImport();
  const progress = useImportProgress(run.isPending);

  const choose = async () => {
    const chosen = await pickFolder();
    // Picker closed without a choice: keep the current folder.
    if (chosen == null) return;
    setFolder(chosen);
    // A new folder resets the grouping choice.
    setChosenGrouping(null);
    setCategory(null);
    run.reset();
    scan.mutate(chosen);
  };

  const report = scan.data ?? null;
  const grouping = chosenGrouping ?? (report ? suggestGrouping(report) : "folder");

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
      {/* Same wash as the download composer. */}
      <div className="relative -mx-8 -mt-5 overflow-hidden px-8 pt-10 pb-6">
        <div className="pointer-events-none absolute inset-0 hero-wash" />

        <div className="relative flex flex-col gap-5">
          <div>
            <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">{t("eyebrow")}</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{t("title")}</h1>
            {/* A div, not a <p>: the tooltip trigger element would close a paragraph. */}
            <div className="mt-2 max-w-prose text-[0.8125rem] leading-relaxed text-muted">
              {t("lead")} <HowItWorks />
            </div>
          </div>

          <FolderPicker folder={folder} phase={phase} onChoose={() => void choose()} />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">{t("activity")}</h2>
        <div className="rounded-2xl bg-tray p-1.5">
          <ImportCard
            folder={folder}
            phase={phase}
            progress={progress}
            grouping={grouping}
            category={category}
            onStart={() => folder != null && run.mutate({ folder, grouping, category })}
            onGroupingChange={setChosenGrouping}
            onCategoryChange={setCategory}
            onCancel={() => cancel.mutate()}
            isCancelling={cancel.isPending}
          />
        </div>
      </section>

      <LastImportSection />

      {children}
    </PageContainer>
  );
}
