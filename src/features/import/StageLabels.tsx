import { useTranslation } from "react-i18next";

import { IMPORT_STAGES, STAGE_WEIGHTS, type ImportRail } from "@/features/import/stages";

/**
 * The three stages named under the rail, each label sitting over its own
 * segment — same weights, so a name is always above the bar it describes.
 *
 * The download feed can do without this: its cards arrive one behind another and
 * the phase line under the bar is enough. Here there is a single card and it is
 * on screen before anything happens, so the rail doubles as the page saying what
 * it is about to do — which is only true if the segments are named.
 */
export function StageLabels({ rail }: { rail: ImportRail }) {
  const { t } = useTranslation("import");

  return (
    <div className="flex gap-1" aria-hidden>
      {IMPORT_STAGES.map((stage, index) => {
        const isFailed = index === rail.failedIndex;
        const isActive = index === rail.activeIndex;
        const isDone = rail.fills[index] >= 1;
        return (
          <span
            key={stage}
            style={{ flexGrow: STAGE_WEIGHTS[index] }}
            className={
              "basis-0 truncate text-[0.625rem] font-semibold tracking-wider uppercase transition-colors " +
              (isFailed ? "text-danger" : isActive ? "text-accent" : isDone ? "text-foreground/70" : "text-muted/50")
            }
          >
            {t(`stages.${stage}`)}
          </span>
        );
      })}
    </div>
  );
}
