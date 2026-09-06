import { toast } from "@heroui/react";
import { Button } from "@heroui/react";
import { Disc3, History, ImageOff, ListX, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { useTranslation } from "react-i18next";

import { EraseDialog } from "@/features/settings/EraseDialog";
import { SectionHeader } from "@/features/settings/SectionHeader";
import {
  useEraseAllData,
  useEraseArtistImages,
  useEraseHistory,
  useEraseLibrary,
  useErasePlaylists,
} from "@/features/settings/hooks";

/** One erase: what it takes away, and the button that takes it. */
function DangerAction({
  name,
  why,
  action,
  icon: Icon,
  onPress,
  isDisabled,
}: {
  name: string;
  why: string;
  action: string;
  icon: typeof Trash2;
  onPress: () => void;
  isDisabled: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-[0.8125rem] font-semibold">{name}</p>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{why}</p>
      </div>
      <Button variant="danger" className="h-10 shrink-0 rounded-xl" onPress={onPress} isDisabled={isDisabled}>
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
 * The actions that cannot be undone — a category of their own now, named for
 * what it holds.
 *
 * It used to be a red-framed block at the foot of the Library page, under the
 * music folder and the diagnostic log. Two problems with that: you had to
 * scroll past it to reach ordinary settings, and you could not *find* it when
 * you actually wanted it, because nothing in the menu said "this is where
 * things get deleted". Five irreversible actions have earned a door with their
 * name on it.
 *
 * The environment reinstall left with the move: it is drastic, not dangerous,
 * and every red row here loses something no backup will bring back. A colour
 * that also means "safe but drastic" stops meaning anything.
 *
 * The full erase and the library erase end in a webview reload, not a process
 * relaunch. The reload is a full front reboot — splash, environment check,
 * sidecar respawned on demand — and the process underneath keeps the setup.
 * `relaunch()` was worse in both worlds: in dev it killed the process the
 * tauri CLI was watching, which took vite down with it and relaunched the app
 * onto a dead dev server — a white window; in prod it paid a whole process
 * restart for nothing the reload does not already redo.
 */
export function DangerSection() {
  const { t } = useTranslation("settings");
  const [asking, setAsking] = useState<EraseKey | null>(null);
  const mutations = {
    eraseLibrary: useEraseLibrary(),
    eraseArtistImages: useEraseArtistImages(),
    erasePlaylists: useErasePlaylists(),
    eraseHistory: useEraseHistory(),
    erase: useEraseAllData(),
  };

  const busy = Object.values(mutations).some((mutation) => mutation.isPending);

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
      toast.success(t(`danger.${key}.doneTitle`));
    } catch (error) {
      setAsking(null);
      toast.danger(t(`danger.${key}.failedTitle`), { description: String(error) });
    }
  };

  const eraseDialog = (key: EraseKey, itemKeys: readonly string[], reloads: boolean, note?: string) => (
    <EraseDialog
      isOpen={asking === key}
      isPending={mutations[key].isPending}
      onClose={() => setAsking(null)}
      onConfirm={() => void runErase(key, reloads)}
      title={t(`danger.${key}.dialogTitle`)}
      intro={t(`danger.${key}.dialogBody`)}
      items={itemKeys.map((item) => t(`danger.${key}.${item}`))}
      note={note}
      confirmLabel={t(`danger.${key}.confirm`)}
    />
  );

  return (
    <>
      <SectionHeader title={t("danger.title")} description={t("danger.description")} />

      <div className="overflow-hidden rounded-xl border border-danger/30 bg-surface">
        <div className="divide-y divide-separator px-5">
          {AIMED_ERASES.map(({ key, icon }) => (
            <DangerAction
              key={key}
              name={t(`danger.${key}.name`)}
              why={t(`danger.${key}.why`)}
              action={t(`danger.${key}.action`)}
              icon={icon}
              onPress={() => setAsking(key)}
              isDisabled={busy}
            />
          ))}
        </div>

        {/* The full erase closes the card in its own tinted band: it is the one
            row that covers all the others, and the eye should have to cross a
            visible boundary to reach it. */}
        <div className="border-t border-danger/20 bg-danger/5 px-5">
          <DangerAction
            name={t("danger.erase.name")}
            why={t("danger.erase.why")}
            action={t("danger.erase.action")}
            icon={Trash2}
            onPress={() => setAsking("erase")}
            isDisabled={busy}
          />
        </div>
      </div>

      {AIMED_ERASES.map(({ key, itemKeys, reloads }) => (
        <Fragment key={key}>{eraseDialog(key, itemKeys, reloads, t(`danger.${key}.keeps`))}</Fragment>
      ))}
      {eraseDialog(
        "erase",
        ["itemFiles", "itemIndex", "itemPlaylists", "itemHistory", "itemKeys"],
        true,
        t("danger.erase.keepsEngine"),
      )}
    </>
  );
}
