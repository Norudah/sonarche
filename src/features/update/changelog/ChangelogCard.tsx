import { Button } from "@heroui/react";
import { ChevronDown, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";
import { ChangelogBody } from "@/features/update/changelog/ChangelogBody";
import { changelogEntries } from "@/features/update/changelog/entries";
import type { ChangelogEntry } from "@/features/update/changelog/parse";

/** `YYYY-MM-DD` read as local noon, not as UTC midnight: parsed the plain way,
 * a release dated the 12th shows as the 11th for anyone west of Greenwich. */
function formatDate(date: string, language: string): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(new Date(`${date}T12:00:00`));
}

const PILL =
  "rounded-full px-2.5 py-1 font-mono text-[0.75rem] transition-colors outline-none " +
  "focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * The version's story, on demand.
 *
 * Closed by default and opened by a button, because it is not what the pane is
 * for: someone arriving here wants to know whether a new version exists, and
 * an entry unfolded under that question would answer a different one. Once
 * open, the past versions are one press away — the history is the same content,
 * so it would be strange to send it to a page of its own.
 *
 * `version` is the running build's. When nothing was written for it — a dev
 * build, a version whose file was forgotten — the newest entry stands in rather
 * than the card vanishing.
 */
export function ChangelogCard({ version }: { version: string | null }) {
  const { t, i18n } = useTranslation("update");
  const entries = useMemo(() => changelogEntries(i18n.language), [i18n.language]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  // Its own card rather than one wrapped around it by the pane: a build whose
  // changelog folder is empty must leave no empty box behind.
  if (entries.length === 0) return null;

  const current: ChangelogEntry = entries.find((entry) => entry.version === version) ?? entries[0];
  const shown = entries.find((entry) => entry.version === selected) ?? current;

  return (
    <SettingCard>
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div>
              <h3 className="font-medium">{t("changelog.title")}</h3>
              <p className="text-[0.8125rem] text-muted">
                {t("changelog.subtitle", { version: open ? shown.version : current.version })}
              </p>
            </div>
          </div>

          <Button variant="secondary" onPress={() => setOpen(!open)} aria-expanded={open}>
            {t(open ? "changelog.hide" : "changelog.view")}
            <ChevronDown className={"size-4 transition-transform " + (open ? "rotate-180" : "")} aria-hidden />
          </Button>
        </div>

        {open && (
          <div className="flex flex-col gap-5 border-t border-separator pt-5">
            {entries.length > 1 && (
              // Not a select: there are a handful of versions and the one being
              // read has to stay visible next to the others, which a collapsed
              // control hides.
              <div className="flex flex-wrap items-center gap-1.5">
                {entries.map((entry) => (
                  <button
                    key={entry.version}
                    type="button"
                    onClick={() => setSelected(entry.version)}
                    aria-current={entry.version === shown.version ? "true" : undefined}
                    className={
                      PILL +
                      (entry.version === shown.version
                        ? " bg-accent/10 text-accent"
                        : " text-muted hover:bg-default/60 hover:text-foreground")
                    }
                  >
                    {entry.version}
                  </button>
                ))}
              </div>
            )}

            <header className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold tracking-tight text-foreground">
                {shown.title ?? t("notes.title", { version: shown.version })}
              </h3>
              {shown.date != null && (
                <p className="text-[0.75rem] text-muted">{formatDate(shown.date, i18n.language)}</p>
              )}
            </header>

            <ChangelogBody entry={shown} />
          </div>
        )}
      </div>
    </SettingCard>
  );
}
