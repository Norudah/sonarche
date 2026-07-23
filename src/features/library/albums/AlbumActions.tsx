import { Dropdown } from "@heroui/react";
import { FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { HERO_PILL_ICON, HERO_PILL_SECONDARY } from "@/features/library/heroPill";
import { HeroPlayButton } from "@/features/library/HeroPlayButton";

const SECONDARY = HERO_PILL_SECONDARY;
const ICON_PILL = HERO_PILL_ICON;

/**
 * Everything destructive, one level down.
 *
 * Delete used to sit in the row as a bare trash icon, permanently under the
 * cursor next to the play button. A menu costs one extra click for an action
 * nobody performs twice, and buys back the row for the two things you actually
 * came here to do.
 */
function OverflowMenu({ onDelete }: { onDelete: () => void }) {
  const { t } = useTranslation("library");

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={t("albums.moreActions")}
        className={`${ICON_PILL} cursor-pointer data-[pressed]:bg-surface`}
      >
        <MoreHorizontal className="size-4 shrink-0" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu onAction={onDelete}>
          <Dropdown.Item id="delete" textValue={t("deleteAlbum.action")}>
            <span className="flex items-center gap-2 text-danger">
              <Trash2 className="size-4" />
              {t("deleteAlbum.action")}
            </span>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

interface AlbumActionsProps {
  onPlay: () => void;
  onInspect: () => void;
  onDelete: () => void;
}

export function AlbumActions({ onPlay, onInspect, onDelete }: AlbumActionsProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <HeroPlayButton onPlay={onPlay} />

      {/* Same FileText icon as the per-track inspect control in the tables, one
       * scope up: this opens the album's own metadata drawer. */}
      <button type="button" onClick={onInspect} className={`${SECONDARY} cursor-pointer`}>
        <FileText className="size-4" />
        {t("albums.inspectAction")}
      </button>

      <OverflowMenu onDelete={onDelete} />
    </div>
  );
}
