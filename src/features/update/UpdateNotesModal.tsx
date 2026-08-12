import { Modal } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { ReleaseNotes, SectionKind } from "@/features/update/notes";

interface UpdateNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  version: string;
  notes: ReleaseNotes;
  /** The parent decides what installing looks like from where it stands: the
   * launch prompt hands off to its progress toast, the settings pane to its
   * status line. The modal only names the action. */
  onInstall: () => void;
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
 * `En bref` leads with the inventory, and a body that yields neither never
 * opens this modal at all (`parseReleaseNotes` returns null).
 */
export function UpdateNotesModal({ isOpen, onClose, version, notes, onInstall }: UpdateNotesModalProps) {
  const { t } = useTranslation("update");

  return (
    <Modal isOpen={isOpen} onOpenChange={(nowOpen) => !nowOpen && onClose()}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className="w-[30rem] max-w-[95vw] rounded-2xl p-0!">
            <div className="flex max-h-[80vh] flex-col">
              <header className="px-6 pt-5 pb-1">
                <p className="text-[0.6875rem] font-medium tracking-wide text-accent uppercase">{t("available")}</p>
                <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                  {t("notes.title", { version })}
                </h2>
              </header>

              <div className="flex flex-col gap-5 overflow-y-auto px-6 py-4">
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

              <footer className="flex items-center justify-end gap-2 border-t border-separator px-6 py-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-full px-3.5 py-1.5 text-[0.8125rem] font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t("notes.later")}
                </button>
                <button
                  type="button"
                  onClick={onInstall}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-accent px-4 py-1.5 text-[0.8125rem] font-medium text-accent-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  {t("install")}
                </button>
              </footer>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
