import { Dropdown } from "@heroui/react";
import { Loader2, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";
import { HeroPlayButton } from "@/features/library/HeroPlayButton";
import { useReenrichAlbum } from "@/features/library/hooks";

/**
 * Outlined pill — the album's secondary actions. Same height and radius as the
 * primary one, so the row reads as one control group rather than as a button
 * with decorations.
 *
 * Padding lives on the two variants rather than in the base: a `px-0` appended
 * after `px-4` in the class string does not win, because Tailwind resolves
 * conflicts by stylesheet order, not by call-site order. It left the icon-only
 * trigger with 32px of padding inside a 40px box, squeezing the glyph to 6px
 * wide — measured in the browser, where it read as a rendering glitch rather
 * than as a CSS conflict.
 */
const PILL =
  "flex h-10 items-center gap-2 rounded-full border border-separator bg-surface/70 text-sm font-medium text-foreground outline-none transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent/40";
const SECONDARY = `${PILL} px-4`;
const ICON_PILL = `${PILL} w-10 justify-center`;

/**
 * Re-runs the acoustic match over every track at once.
 *
 * The drawer already offers this per track, which is the wrong unit when a
 * whole record came in badly tagged: eighteen panels to open is not a workflow.
 * The result is stated in place rather than as a toast — it answers a question
 * the user just asked, and belongs next to the button they asked it with.
 *
 * The sparkles turn a half-turn on hover. CSS and not Motion because it is a
 * hover flourish on a static icon, the same class of thing as the row washes;
 * `duration-500` overrides the app's 120ms default, which is tuned for colour
 * shifts and would spin this too fast to read as a turn.
 */
function RematchAction({ album }: { album: Album }) {
  const { t } = useTranslation("library");
  const reenrich = useReenrichAlbum();

  const feedback = reenrich.isError
    ? { text: t("metadata.reenrichFailed"), tone: "text-danger" }
    : reenrich.isSuccess
      ? {
          text: t("albums.rematchDone", {
            matched: reenrich.data.matched,
            total: reenrich.data.total,
          }),
          tone: reenrich.data.matched > 0 ? "text-success" : "text-muted",
        }
      : null;

  return (
    <>
      <button
        type="button"
        disabled={reenrich.isPending}
        onClick={() => reenrich.mutate(album.tracks.map((track) => track.id))}
        className={`${SECONDARY} group/rematch cursor-pointer disabled:cursor-default disabled:opacity-60`}
      >
        {reenrich.isPending ? (
          <Loader2 className="size-4 animate-spin text-accent" />
        ) : (
          <Sparkles className="size-4 text-accent transition-transform duration-500 ease-out group-hover/rematch:rotate-180 motion-reduce:transition-none" />
        )}
        {reenrich.isPending ? t("albums.rematching") : t("albums.rematch")}
      </button>
      {feedback && <p className={`text-[0.8125rem] ${feedback.tone}`}>{feedback.text}</p>}
    </>
  );
}

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
  album: Album;
  onPlay: () => void;
  onDelete: () => void;
}

export function AlbumActions({ album, onPlay, onDelete }: AlbumActionsProps) {
  const { t } = useTranslation("library");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <HeroPlayButton onPlay={onPlay} />

      <RematchAction album={album} />

      {/* The album-wide metadata panel does not exist yet. Same "coming soon"
       * treatment as the card's inspect affordance and the drawer's view-album
       * action: the slot is placed now so the row's layout is settled when it
       * lands. */}
      <button
        type="button"
        disabled
        title={t("metadata.comingSoon")}
        className={`${SECONDARY} opacity-50`}
      >
        <Pencil className="size-4" />
        {t("albums.edit")}
      </button>

      <OverflowMenu onDelete={onDelete} />
    </div>
  );
}
