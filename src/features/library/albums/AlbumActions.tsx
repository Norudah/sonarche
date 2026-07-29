import { Dropdown } from "@heroui/react";
import { FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { HERO_BUTTON_ICON, HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { springs } from "@/shared/motion/tokens";

const SECONDARY = HERO_BUTTON_SECONDARY;
const ICON_PILL = HERO_BUTTON_ICON;

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
  onShuffle: () => void;
  onInspect: () => void;
  onDelete: () => void;
}

export function AlbumActions({ onPlay, onShuffle, onInspect, onDelete }: AlbumActionsProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />

      {/* Same FileText icon as the per-track inspect control in the tables, one
       * scope up: this opens the album's own metadata drawer. Same press
       * feedback as the play pills beside it — the row moves as one family. */}
      <motion.button
        type="button"
        onClick={onInspect}
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.03 }}
        transition={springs.snappy}
        className={`${SECONDARY} cursor-pointer`}
      >
        <FileText className="size-4" />
        {t("albums.inspectAction")}
      </motion.button>

      <OverflowMenu onDelete={onDelete} />
    </div>
  );
}
