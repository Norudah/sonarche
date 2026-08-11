import { Dropdown } from "@heroui/react";
import { FilePen, FolderInput, ListMusic, ListPlus, MoreHorizontal, Trash2 } from "lucide-react";
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
          {/* The pull half of refiling: stand on your record, fetch the tracks
           * you actually like from the rest of the shelf. */}
          <Dropdown.Item id="add-tracks" textValue={t("move.addTracksAction")} onAction={onAddTracks}>
            <ListPlus className="size-4" />
            {t("move.addTracksAction")}
          </Dropdown.Item>
          {/* The whole record at once — how two albums become one, and how a
           * hand-made collection absorbs a release it grew out of. */}
          <Dropdown.Item id="move-to-album" textValue={t("move.menuAction")} onAction={onMoveToAlbum}>
            <FolderInput className="size-4" />
            {t("move.menuAction")}
          </Dropdown.Item>
          <Dropdown.Item id="delete" textValue={t("deleteAlbum.action")} onAction={onDelete}>
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
    /* Two groups, not one row of four: playing and managing are different
     * subjects, and the wider gap between them is what says so. Inside each
     * group the buttons stay tight, which is also where the shape rule becomes
     * readable — two round objects, then two rectangular ones. */
    <div className="flex flex-wrap items-center gap-3.5">
      <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />

      <div className="flex items-center gap-2">
        {/* "Modifier", not "Inspecter": what opens is a form you write in, and
         * a page-with-a-pen says so where a bare page only promised reading.
         * The same pair — this icon, this word — is the app's one door to
         * editing anything, from a track row to an artist to a playlist. */}
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
