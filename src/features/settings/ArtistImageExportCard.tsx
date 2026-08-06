import { Button, Spinner, toast } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCard } from "@/features/settings/SettingCard";

/**
 * Take the artist images out of the app's belly, named by artist.
 *
 * Internally the files carry random stems (that is what makes the cache
 * trivial), so revealing the raw folder would show a pile of anonymous
 * images. The export is what makes them usable: a copy per artist, named
 * after them, packed into a folder of its own inside wherever the user
 * pointed — never scattered loose into the target.
 *
 * Strings live in the `library` namespace: the operation is about the
 * library's artists, and namespaces follow the domain, not the page.
 */
export function ArtistImageExportCard() {
  const { t } = useTranslation("library");
  const [isExporting, setIsExporting] = useState(false);

  const exportAll = async () => {
    const chosen = await open({ directory: true, multiple: false });
    if (typeof chosen !== "string") return;
    setIsExporting(true);
    try {
      const result = await invoke<{ exported: number; missing: number; folder: string }>("export_artist_images", {
        dest: chosen,
        folderName: t("artists.export.folderName"),
      });
      if (result.exported === 0) {
        toast(t("artists.export.emptyTitle"), { description: t("artists.export.empty") });
      } else {
        toast.success(t("artists.export.doneTitle"), {
          description: t("artists.export.done", { count: result.exported, folder: result.folder }),
        });
      }
    } catch (error) {
      toast.danger(t("artists.export.failedTitle"), { description: String(error) });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <SettingCard>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="font-medium">{t("artists.export.name")}</h3>
          <p className="max-w-prose text-sm text-muted">{t("artists.export.why")}</p>
        </div>
        <Button variant="secondary" className="h-10 self-start rounded-xl" onPress={exportAll} isDisabled={isExporting}>
          {isExporting && <Spinner size="sm" />}
          {t("artists.export.action")}
        </Button>
      </div>
    </SettingCard>
  );
}
