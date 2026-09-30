import { cn, Modal } from "@heroui/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SettingsNav, SettingsNavStrip } from "@/features/settings/SettingsNav";
import { closeSettings, useSettingsDialog } from "@/shared/lib/settingsDialog";

/** Rendered in both layouts, shown in one. */
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

/** Settings as a dialog over the running app: three ways out, nothing to
 * return to. The only modal with a backdrop blur, since it covers the whole app. */
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
              {/* Narrow: the close button sits beside the scrolling strip, not over it. */}
              <div className="flex items-center border-b border-separator bg-panel md:hidden">
                <SettingsNavStrip current={category} />
                <CloseButton label={t("close")} className="mr-2 ml-1 shrink-0" />
              </div>

              {/* Wide: floats in the gutter. */}
              <CloseButton label={t("close")} className="absolute top-4 right-4 z-10 hidden md:flex" />

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Bounded reading column. `settings-pane` scopes button sizing (theme.css). */}
                <div className="settings-pane flex w-full max-w-2xl flex-col gap-5 px-8 py-7">{children}</div>
              </div>
            </div>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
