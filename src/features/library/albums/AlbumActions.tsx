import { Dropdown } from "@heroui/react";
import { FilePen, FolderInput, ListMusic, ListPlus, MoreHorizontal, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { HERO_BUTTON_ICON, HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { springs } from "@/shared/motion/tokens";

const SECONDARY = HERO_BUTTON_SECONDARY;
const ICON_PILL = HERO_BUTTON_ICON;

/** Destructive and rare actions, one level down. */
function OverflowMenu({
  onDelete,
  onAddToPlaylist,
  onMoveToAlbum,
  onAddTracks,
}: {
  onDelete: () => void;
  onAddToPlaylist: () => void;
  onMoveToAlbum: () => void;
  onAddTracks: () => void;
}) {
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
        <Dropdown.Menu>
          <Dropdown.Item id="add-to-playlist" textValue={t("playlists.addTo")} onAction={onAddToPlaylist}>
            <ListMusic className="size-4" />
            {t("playlists.addTo")}
          </Dropdown.Item>
          {/* Pull tracks from the rest of the shelf onto this record. */}
          <Dropdown.Item id="add-tracks" textValue={t("move.addTracksAction")} onAction={onAddTracks}>
            <ListPlus className="size-4" />
            {t("move.addTracksAction")}
          </Dropdown.Item>
          {/* Moves the whole record: merges two albums, or absorbs a release into a collection. */}
          <Dropdown.Item id="move-to-album" textValue={t("move.menuAction")} onAction={onMoveToAlbum}>
            <FolderInput className="size-4" />
            {t("move.menuAction")}
          </Dropdown.Item>
          <Dropdown.Item id="delete" variant="danger" textValue={t("deleteAlbum.action")} onAction={onDelete}>
            <Trash2 className="size-4" />
            {t("deleteAlbum.action")}
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

interface AlbumActionsProps {
  onPlay: () => void;
  onShuffle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddToPlaylist: () => void;
  onMoveToAlbum: () => void;
  onAddTracks: () => void;
}

export function AlbumActions({
  onPlay,
  onShuffle,
  onEdit,
  onDelete,
  onAddToPlaylist,
  onMoveToAlbum,
  onAddTracks,
}: AlbumActionsProps) {
  const { t } = useTranslation("library");

  return (
    /* Play and manage as two groups: round buttons, then rectangular ones. */
    <div className="flex flex-wrap items-center gap-3.5">
      <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />

      <div className="flex items-center gap-2">
        {/* "Modifier" with this icon is the app's single door to editing. */}
        <motion.button
          type="button"
          onClick={onEdit}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03 }}
          transition={springs.snappy}
          className={`${SECONDARY} cursor-pointer`}
        >
          <FilePen className="size-4" />
          {t("edit")}
        </motion.button>

        <OverflowMenu
          onDelete={onDelete}
          onAddToPlaylist={onAddToPlaylist}
          onMoveToAlbum={onMoveToAlbum}
          onAddTracks={onAddTracks}
        />
      </div>
    </div>
  );
}
