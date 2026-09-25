import { useTranslation } from "react-i18next";

import { IMPORT_STAGES, STAGE_WEIGHTS, type ImportRail } from "@/features/import/stages";

/** Stage names under the rail, with the rail's weights so each sits over its segment. */
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
