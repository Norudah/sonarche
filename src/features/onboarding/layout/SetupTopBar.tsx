import { cn } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { LanguageChoice } from "@/shared/i18n/LanguageChoice";

/** Where the user is, and the language, before anything has to be read.
 * Not clickable: the action bar moves between screens. */
export function SetupTopBar({ n, total }: { n: number; total: number }) {
  const { t } = useTranslation("onboarding");

  return (
    // Above the window drag strip, which would swallow the language clicks.
    <div className="relative z-20 flex min-h-8 items-center gap-1">
      <span className="flex items-center gap-2 text-xs font-medium text-muted tabular-nums">
        <span className="flex items-center gap-1" aria-hidden>
          {Array.from({ length: total }, (_, index) => (
            <span
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-[width,background-color] duration-300 ease-out",
                index + 1 === n ? "w-4 bg-accent" : "w-1.5",
                index + 1 < n && "bg-accent/45",
                index + 1 > n && "bg-muted/30",
              )}
            />
          ))}
        </span>
        {t("nav.stepOf", { n, total })}
      </span>

      <div className="ml-auto w-44">
        <LanguageChoice label={t("nav.language")} size="sm" />
      </div>
    </div>
  );
}
