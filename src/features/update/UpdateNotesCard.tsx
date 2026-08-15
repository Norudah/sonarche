import { useTranslation } from "react-i18next";

import type { ReleaseNotes, SectionKind } from "@/features/update/notes";

interface UpdateNotesCardProps {
  version: string;
  notes: ReleaseNotes;
}

const SECTION_KEYS: Record<SectionKind, string> = {
  breaking: "notes.breaking",
  features: "notes.features",
  fixes: "notes.fixes",
  perf: "notes.perf",
};

/**
 * The story of the new version, told twice: the hand-written highlights first,
 * as the reason to press Install, and the generated changelog under them for
 * whoever wants the inventory. Either half can be missing — a release with no
 * `En bref` leads with the inventory, and a body that yields neither renders
 * no card at all (`parseReleaseNotes` returns null upstream).
 *
 * A card in the updates pane rather than a modal: the toast already navigates
 * here, and the notes belong next to the Install button they argue for.
 */
export function UpdateNotesCard({ version, notes }: UpdateNotesCardProps) {
  const { t } = useTranslation("update");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="text-[0.6875rem] font-medium tracking-wide text-accent uppercase">{t("notes.whatsNew")}</p>
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          {t("notes.title", { version })}
        </h3>
      </header>

      {notes.highlights.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notes.highlights.map((item) => (
            <li key={item} className="flex gap-2.5 text-sm text-foreground">
              <span aria-hidden className="mt-[0.4375rem] size-1.5 shrink-0 rounded-full bg-accent" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {notes.sections.length > 0 && (
        <div className="flex flex-col gap-4">
          {notes.highlights.length > 0 && (
            <p className="border-t border-separator pt-4 text-[0.6875rem] font-medium tracking-wide text-muted uppercase">
              {t("notes.detail")}
            </p>
          )}
          {notes.sections.map((section) => (
            <section key={section.title} className="flex flex-col gap-1.5">
              <h3 className="text-[0.75rem] font-medium text-foreground">
                {section.kind ? t(SECTION_KEYS[section.kind]) : section.title}
              </h3>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item} className="flex gap-2 text-[0.8125rem] text-muted">
                    <span aria-hidden className="mt-[0.5rem] size-1 shrink-0 rounded-full bg-muted/50" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
