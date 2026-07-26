import { Dropdown } from "@heroui/react";
import { FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

// Round, like every other icon-only control in the app: the hero's play pill,
// its icon pills, the sidebar. `shrink-0` is what keeps them round — flex
// children shrink by default, and a too-narrow cell turns both circles to ovals.
const ACTION =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-default/70 focus-visible:ring-2 focus-visible:ring-accent/40";

/**
 * The end-of-row controls, shared by the album tracklist and the library-wide
 * table so both rows terminate the same way.
 *
 * Two controls, not four. Metadata keeps a button of its own because inspecting
 * tags is what this app is for — burying it in a menu would hide the one action
 * the page exists to offer. Everything else, delete included, goes behind the
 * menu, where a destructive click takes a deliberate second step instead of
 * sitting under the cursor on every row.
 */
export function RowActions({ onInspect, onDelete }: { onInspect: () => void; onDelete: () => void }) {
  const { t } = useTranslation("library");

  return (
    // Always on screen, never loud. Actions that appear on hover are actions
    // nobody knows exist until they sweep the row, and on a touchpad that is a
    // discovery problem. They idle at a third opacity — present enough to read
    // as "there is something here", quiet enough not to compete with the
    // titles — and come up to full on row hover.
    <div className="flex items-center justify-end gap-1 opacity-35 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
      <button
        type="button"
        onClick={onInspect}
        aria-label={t("metadata.inspect")}
        className={`${ACTION} hover:text-foreground`}
      >
        <FileText className="size-4" />
      </button>

      <Dropdown>
        <Dropdown.Trigger
          aria-label={t("albums.moreActions")}
          className={`${ACTION} hover:text-foreground data-[pressed]:bg-default/70`}
        >
          <MoreHorizontal className="size-4" />
        </Dropdown.Trigger>
        <Dropdown.Popover placement="bottom end">
          <Dropdown.Menu onAction={onDelete}>
            <Dropdown.Item id="delete" textValue={t("delete.action")}>
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
