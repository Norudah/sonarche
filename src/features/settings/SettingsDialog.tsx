import { cn, Modal } from "@heroui/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SettingsNav, SettingsNavStrip } from "@/features/settings/SettingsNav";
import { closeSettings, useSettingsDialog } from "@/shared/lib/settingsDialog";

/** The way out, in the two places it has to sit. Rendered twice and shown once
 * — the wide layout floats it over the content gutter, the narrow one parks it
 * beside the scrolling category strip. */
function CloseButton({ label, className }: { label: string; className: string }) {
  return (
    <button
      type="button"
      onClick={closeSettings}
      aria-label={label}
      className={cn(
        "size-8 cursor-pointer items-center justify-center rounded-lg text-muted outline-none",
        "transition-colors hover:bg-default/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40",
        className,
      )}
    >
      <X className="size-4" />
    </button>
  );
}

/**
 * Settings, as a dialog over the app.
 *
 * It used to be a mode: a route that swapped the sidebar's entire nav for a
 * category menu, entered and left through one button that changed its own face
 * from a gear to a cross, with a ref remembering which page to return to. You
 * lost your place going in, and there was exactly one way out.
 *
 * A dialog is the right grammar for a detour. The app stays visible and running
 * behind it — this is a music player, and the queue you were looking at is
 * still there — there are three ways out (the cross, Escape, the veil), and
 * nothing has to remember where you came from because you never left.
 *
 * It also earns its own menu: a rail inside the dialog can carry titled groups
 * and, in a moment, a search field, none of which would fit the app's nav
 * without borrowing its grammar for something that is not navigation.
 *
 * The veil is the app's `--backdrop` — calibrated for both themes, and darker
 * in the night than in the day — plus a slight blur. The blur is spent here
 * and nowhere else on purpose: every other modal in the app covers an object
 * on the page it opened from, and this one covers the whole app.
 */
export function SettingsDialog({ children }: { children: ReactNode }) {
  const { t } = useTranslation("settings");
  const { isOpen, category } = useSettingsDialog();

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) closeSettings();
      }}
    >
      <Modal.Backdrop className="backdrop-blur-[3px]">
        <Modal.Container>
          <Modal.Dialog className="flex h-[82vh] max-h-[46rem] w-[94vw] max-w-[64rem] flex-row! overflow-hidden rounded-2xl p-0!">
            <SettingsNav current={category} />

            <div className="relative flex min-w-0 flex-1 flex-col bg-surface">
              {/* Below md the cross shares a row with the category strip rather
                  than floating over it: the strip scrolls, so anything floating
                  above its right edge would sit on a chip that can still be
                  scrolled underneath and never clicked. */}
              <div className="flex items-center border-b border-separator bg-panel md:hidden">
                <SettingsNavStrip current={category} />
                <CloseButton label={t("close")} className="mr-2 ml-1 shrink-0" />
              </div>

              {/* Above md it floats: the content column is a bounded reading
                  measure inside a wider pane, so the cross sits in the gutter
                  that leaves and never crosses a line of text. */}
              <CloseButton label={t("close")} className="absolute top-4 right-4 z-10 hidden md:flex" />

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* A bounded reading column, not the full pane width: a settings
                    control has a natural size, so a card stretched edge to edge
                    would just be half-empty. The space to its right is
                    deliberate, the way system-settings panes leave it. */}
                <div className="flex w-full max-w-2xl flex-col gap-5 px-8 py-7">{children}</div>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
