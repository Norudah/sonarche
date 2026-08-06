import { Button, toast } from "@heroui/react";
import { relaunch } from "@tauri-apps/plugin-process";
import { ChevronDown, RotateCcw, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { EraseDataDialog } from "@/features/settings/EraseDataDialog";
import { useEraseAllData, useReinstallEnvironment } from "@/features/settings/hooks";
import { springs } from "@/shared/motion/tokens";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/** One dangerous action: what it does, and the button that does it. */
function DangerAction({
  name,
  why,
  action,
  icon: Icon,
  onPress,
  isDisabled,
  isDestructive,
}: {
  name: string;
  why: string;
  action: string;
  icon: typeof Trash2;
  onPress: () => void;
  isDisabled: boolean;
  /** Red is spent on the one action that destroys something. The reinstall
   * lives in this section because it is drastic, not because it is dangerous —
   * painting both the same colour would make the colour mean nothing on the
   * row where it has to. */
  isDestructive: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-[0.8125rem] font-semibold">{name}</p>
        <p className="max-w-prose text-[0.8125rem] leading-relaxed text-muted">{why}</p>
      </div>
      <Button
        variant={isDestructive ? "danger" : "secondary"}
        className="h-10 shrink-0 rounded-xl"
        onPress={onPress}
        isDisabled={isDisabled}
      >
        <Icon className="size-4" />
        {action}
      </Button>
    </div>
  );
}

/**
 * The two actions that cannot be undone, filed where nobody reaches them by
 * accident.
 *
 * Folded shut by default, in its own red frame, at the bottom of the page. The
 * shape is borrowed openly from GitHub's, because it works for the reason
 * every part of it exists: the fold means you cannot click through on your way
 * somewhere else, and the frame means that once it is open you know what kind
 * of screen you are on.
 *
 * Both actions end in a relaunch. Neither is worth trying to recover from
 * in-place — the app has just deleted the thing every screen is reading.
 */
export function DangerZone() {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [asking, setAsking] = useState<"erase" | "reinstall" | null>(null);
  const erase = useEraseAllData();
  const reinstall = useReinstallEnvironment();

  const busy = erase.isPending || reinstall.isPending;

  const run = async (what: "erase" | "reinstall") => {
    try {
      await (what === "erase" ? erase.mutateAsync() : reinstall.mutateAsync());
      await relaunch();
    } catch (error) {
      setAsking(null);
      toast.danger(t(`library.danger.${what === "erase" ? "erase" : "reinstall"}.failedTitle`), {
        description: String(error),
      });
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-danger/30 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="text-[0.8125rem] font-semibold text-danger">{t("library.danger.title")}</span>
          <span className="text-[0.8125rem] text-muted">{t("library.danger.description")}</span>
          {/* Folded, the zone still says what it holds: the two actions by
              name, so nobody has to open it just to find out. The fold keeps
              being the misclick guard; it stops being a mystery box. */}
          {!open && (
            <span className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted">
                <RotateCcw className="size-3.5 shrink-0" />
                {t("library.danger.reinstall.name")}
              </span>
              <span className="inline-flex items-center gap-1.5 text-[0.75rem] text-muted">
                <Trash2 className="size-3.5 shrink-0" />
                {t("library.danger.erase.name")}
              </span>
            </span>
          )}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={springs.snappy} className="shrink-0">
          <ChevronDown className="size-4 text-muted" />
        </motion.span>
      </button>

      {open && (
        <div className="divide-y divide-separator border-t border-danger/20 px-5">
          <DangerAction
            name={t("library.danger.reinstall.name")}
            why={t("library.danger.reinstall.why")}
            action={t("library.danger.reinstall.action")}
            icon={RotateCcw}
            onPress={() => setAsking("reinstall")}
            isDisabled={busy}
            isDestructive={false}
          />
          <DangerAction
            name={t("library.danger.erase.name")}
            why={t("library.danger.erase.why")}
            action={t("library.danger.erase.action")}
            icon={Trash2}
            onPress={() => setAsking("erase")}
            isDisabled={busy}
            isDestructive
          />
        </div>
      )}

      {/* The reinstall is a plain yes/no: nothing it removes is irreplaceable,
          and putting the typing exercise on both would teach people to type
          through it. */}
      <ConfirmDialog
        isOpen={asking === "reinstall"}
        onClose={() => setAsking(null)}
        status="warning"
        icon={RotateCcw}
        title={t("library.danger.reinstall.dialogTitle")}
        cancelLabel={t("library.danger.reinstall.cancel")}
        confirmLabel={t("library.danger.reinstall.confirm")}
        onConfirm={() => void run("reinstall")}
        isPending={reinstall.isPending}
      >
        <p>{t("library.danger.reinstall.dialogBody")}</p>
      </ConfirmDialog>

      <EraseDataDialog
        isOpen={asking === "erase"}
        isErasing={erase.isPending}
        onClose={() => setAsking(null)}
        onConfirm={() => void run("erase")}
      />
    </div>
  );
}
