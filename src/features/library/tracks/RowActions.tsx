import { Dropdown } from "@heroui/react";
import { FilePen, FolderInput, ListMusic, ListX, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FavoriteButton } from "@/features/library/playlists/FavoriteButton";

// Round like the app's other icon buttons; `shrink-0` keeps them round.
const ACTION =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 focus-visible:ring-2 focus-visible:ring-accent/40";

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  /** Set when the row should carry the favorites heart. */
  favoriteId?: number;
  /** Omitted by tables that can't host the picker. */
  onAddToPlaylist?: () => void;
  /** Refiling: the file moves too. */
  onMoveToAlbum?: () => void;
  /** Playlist rows only; the file stays. */
  onRemoveFromPlaylist?: () => void;
}

/** End-of-row controls shared by every track table: metadata as its own
 * button, everything else (delete included) in the menu. */
export function RowActions({
  onEdit,
  onDelete,
  favoriteId,
  onAddToPlaylist,
  onMoveToAlbum,
  onRemoveFromPlaylist,
}: RowActionsProps) {
  const { t } = useTranslation("library");

  return (
    // Always visible at low opacity so they're discoverable, full on row hover.
    // `:focus-visible`: focus restored by closing the drawer shouldn't light them.
    <div className="flex items-center justify-end gap-1 opacity-35 transition-opacity group-hover/row:opacity-100 has-[:focus-visible]:opacity-100">
      {favoriteId != null && <FavoriteButton itemId={favoriteId} className={ACTION} />}
      <button
        type="button"
        onClick={onEdit}
        aria-label={t("metadata.editMetadata")}
        className={`${ACTION} hover:text-foreground`}
      >
        <FilePen className="size-4" />
      </button>

      <Dropdown>
        <Dropdown.Trigger
          aria-label={t("albums.moreActions")}
          className={`${ACTION} hover:text-foreground data-[pressed]:bg-default/70`}
        >
          <MoreHorizontal className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu>
            {onAddToPlaylist && (
              <Dropdown.Item id="add-to-playlist" textValue={t("playlists.addTo")} onAction={onAddToPlaylist}>
                <ListMusic className="size-4" />
                {t("playlists.addTo")}
              </Dropdown.Item>
            )}
            {onMoveToAlbum && (
              <Dropdown.Item id="move-to-album" textValue={t("move.menuAction")} onAction={onMoveToAlbum}>
                <FolderInput className="size-4" />
                {t("move.menuAction")}
              </Dropdown.Item>
            )}
            {onRemoveFromPlaylist && (
              <Dropdown.Item
                id="remove-from-playlist"
                textValue={t("playlists.removeFrom")}
                onAction={onRemoveFromPlaylist}
              >
                <ListX className="size-4" />
                {t("playlists.removeFrom")}
              </Dropdown.Item>
            )}
            <Dropdown.Item id="delete" variant="danger" textValue={t("delete.action")} onAction={onDelete}>
              <Trash2 className="size-4" />
              {t("delete.action")}
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
