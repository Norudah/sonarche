import { Button, toast } from "@heroui/react";
import { Disc3, History, ImageOff, ListX, RotateCcw, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";

import { EraseDialog } from "@/features/settings/EraseDialog";
import {
  useEraseAllData,
  useEraseArtistImages,
  useEraseHistory,
  useEraseLibrary,
  useErasePlaylists,
  useReinstallEnvironment,
} from "@/features/settings/hooks";
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
  /** Red is spent on the actions that destroy something. The reinstall lives
   * in this section because it is drastic, not because it is dangerous —
   * painting it the same colour would make the colour mean nothing on the
   * rows where it has to. */
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

/** The aimed erases, mildest first; the full erase is not in this list — it
 * closes the card in its own emphasized band. */
const AIMED_ERASES = [
  { key: "eraseLibrary", icon: Disc3, itemKeys: ["itemFiles", "itemIndex", "itemPlaylists"], reloads: true },
  { key: "eraseArtistImages", icon: ImageOff, itemKeys: ["itemFiles"], reloads: false },
  { key: "erasePlaylists", icon: ListX, itemKeys: ["itemLists", "itemCovers"], reloads: false },
  { key: "eraseHistory", icon: History, itemKeys: ["itemDownloads", "itemImports", "itemUndo"], reloads: false },
] as const;

type EraseKey = (typeof AIMED_ERASES)[number]["key"] | "erase";

/**
 * The actions that cannot be undone, filed where nobody reaches them by
 * accident: one open card at the bottom of the page, in its own red frame.
 *
 * No fold anymore: with five aimed erases the folded summary was longer than
 * the list, and the typed phrase on every destructive row is the real
 * misclick guard — the fold only hid what could be erased. The frame still
 * marks what kind of screen this is.
 *
 * The full erase and the library erase end in a webview reload, not a process
 * relaunch. The reload is a full front reboot — splash, environment check,
 * sidecar respawned on demand — and the process underneath keeps the setup.
 * `relaunch()` was worse in both worlds: in dev it killed the process the
 * tauri CLI was watching, which took vite down with it and relaunched the app
 * onto a dead dev server — a white window; in prod it paid a whole process
 * restart for nothing the reload does not already redo.
 */
export function DangerZone() {
  const { t } = useTranslation("settings");
  const [asking, setAsking] = useState<EraseKey | "reinstall" | null>(null);
  const reinstall = useReinstallEnvironment();
  const mutations = {
    eraseLibrary: useEraseLibrary(),
    eraseArtistImages: useEraseArtistImages(),
    erasePlaylists: useErasePlaylists(),
    eraseHistory: useEraseHistory(),
    erase: useEraseAllData(),
  };

  const busy = reinstall.isPending || Object.values(mutations).some((mutation) => mutation.isPending);

  const runErase = async (key: EraseKey, reloads: boolean) => {
    try {
      await mutations[key].mutateAsync();
      // Factory settings include the front's own: theme, language choice, the
      // remembered download category all live in localStorage. Only the full
      // erase claims them — the aimed ones touch nothing the user chose.
      if (key === "erase") window.localStorage.clear();
      if (reloads) {
        window.location.reload();
        return;
      }
      setAsking(null);
      toast.success(t(`library.danger.${key}.doneTitle`));
    } catch (error) {
      setAsking(null);
      toast.danger(t(`library.danger.${key}.failedTitle`), { description: String(error) });
    }
  };

  const runReinstall = async () => {
    try {
      await reinstall.mutateAsync();
      window.location.reload();
    } catch (error) {
      setAsking(null);
      toast.danger(t("library.danger.reinstall.failedTitle"), { description: String(error) });
    }
  };

  const eraseDialog = (key: EraseKey, itemKeys: readonly string[], reloads: boolean, note?: string) => (
    <EraseDialog
      isOpen={asking === key}
      isPending={mutations[key].isPending}
      onClose={() => setAsking(null)}
      onConfirm={() => void runErase(key, reloads)}
      title={t(`library.danger.${key}.dialogTitle`)}
      intro={t(`library.danger.${key}.dialogBody`)}
      items={itemKeys.map((item) => t(`library.danger.${key}.${item}`))}
      note={note}
      confirmLabel={t(`library.danger.${key}.confirm`)}
    />
  );

  return (
    <div className="overflow-hidden rounded-xl border border-danger/30 bg-surface">
      <div className="flex flex-col gap-0.5 px-5 py-4">
        <p className="text-[0.8125rem] font-semibold text-danger">{t("library.danger.title")}</p>
        <p className="text-[0.8125rem] text-muted">{t("library.danger.description")}</p>
      </div>

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
        {AIMED_ERASES.map(({ key, icon }) => (
          <DangerAction
            key={key}
            name={t(`library.danger.${key}.name`)}
            why={t(`library.danger.${key}.why`)}
            action={t(`library.danger.${key}.action`)}
            icon={icon}
            onPress={() => setAsking(key)}
            isDisabled={busy}
            isDestructive
          />
        ))}
      </div>

      {/* The full erase closes the card in its own tinted band: it is the one
          row that covers all the others, and the eye should have to cross a
          visible boundary to reach it. */}
      <div className="border-t border-danger/20 bg-danger/5 px-5">
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
        onConfirm={() => void runReinstall()}
        isPending={reinstall.isPending}
      >
        <p>{t("library.danger.reinstall.dialogBody")}</p>
      </ConfirmDialog>

      {AIMED_ERASES.map(({ key, itemKeys, reloads }) => (
        <Fragment key={key}>{eraseDialog(key, itemKeys, reloads, t(`library.danger.${key}.keeps`))}</Fragment>
      ))}
      {eraseDialog(
        "erase",
        ["itemFiles", "itemIndex", "itemPlaylists", "itemHistory", "itemKeys"],
        true,
        t("library.danger.erase.keepsEngine"),
      )}
    </div>
  );
}
