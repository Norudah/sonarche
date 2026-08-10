import { Dropdown } from "@heroui/react";
import { FilePen, ListMusic, ListX, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FavoriteButton } from "@/features/library/playlists/FavoriteButton";

// Round, like every other icon-only control in the app: the hero's play pill,
// its icon pills, the sidebar. `shrink-0` is what keeps them round — flex
// children shrink by default, and a too-narrow cell turns both circles to ovals.
const ACTION =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 focus-visible:ring-2 focus-visible:ring-accent/40";

interface RowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
  /** The row's beets item id, when the row should carry the favorites heart. */
  favoriteId?: number;
  /** Offers "add to a playlist" in the menu. Optional so the tables that
   * cannot host the picker simply don't grow the item. */
  onAddToPlaylist?: () => void;
  /** Playlist rows only: take this row out of the list — the file stays. */
  onRemoveFromPlaylist?: () => void;
}

/**
 * The end-of-row controls, shared by the album tracklist, the library-wide
 * table and the playlist so all three rows terminate the same way.
 *
 * Two controls, not four. Metadata keeps a button of its own because inspecting
 * tags is what this app is for — burying it in a menu would hide the one action
 * the page exists to offer. Everything else, delete included, goes behind the
 * menu, where a destructive click takes a deliberate second step instead of
 * sitting under the cursor on every row.
 */
export function RowActions({ onEdit, onDelete, favoriteId, onAddToPlaylist, onRemoveFromPlaylist }: RowActionsProps) {
  const { t } = useTranslation("library");

  return (
    // Always on screen, never loud. Actions that appear on hover are actions
    // nobody knows exist until they sweep the row, and on a touchpad that is a
    // discovery problem. They idle at a third opacity — present enough to read
    // as "there is something here", quiet enough not to compete with the
    // titles — and come up to full on row hover.
    <div className="flex items-center justify-end gap-1 opacity-35 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
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
            <Dropdown.Item id="delete" textValue={t("delete.action")} onAction={onDelete}>
              <span className="flex items-center gap-2 text-danger">
                <Trash2 className="size-4" />
                {t("delete.action")}
              </span>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
