import { Dropdown } from "@heroui/react";
import { FilePen, MoreHorizontal, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import type { LibraryTrack } from "@/features/library/api";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HERO_BUTTON_ICON, HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { HeroWash } from "@/features/library/HeroWash";
import type { Playlist } from "@/features/library/playlists/api";
import { PlaylistCoverMosaic } from "@/features/library/playlists/PlaylistCoverMosaic";
import { playlistCovers, playlistDuration } from "@/features/library/playlists/playlists";
import { formatDuration } from "@/shared/lib/format";
import { springs } from "@/shared/motion/tokens";

interface PlaylistHeroProps {
  playlist: Playlist;
  /** Favorites shows its localized label. */
  displayName: string;
  /** Members in playlist order. */
  tracks: LibraryTrack[];
  onPlay: () => void;
  onShuffle: () => void;
  /** Opens the edit dialog. */
  onEdit: () => void;
  onDelete: () => void;
  ref?: Ref<HTMLElement>;
}

/** The album hero's counterpart. Favorites only gets playback: its name, tile
 * and sidebar place are fixed. */
export function PlaylistHero({
  playlist,
  displayName,
  tracks,
  onPlay,
  onShuffle,
  onEdit,
  onDelete,
  ref,
}: PlaylistHeroProps) {
  const { t } = useTranslation("library");
  const locked = playlist.kind === "favorites";

  const seconds = playlistDuration(tracks);
  const meta = [t("trackCount", { count: tracks.length }), seconds > 0 ? formatDuration(seconds) : null].filter(
    Boolean,
  );

  return (
    <header ref={ref} className="relative -mx-8 -mt-5 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        <HeroBreadcrumb
          label={t("breadcrumb")}
          up={paths.libraryPlaylists}
          upLabel={t("playlists.back")}
          current={displayName}
        />

        <div className="mt-5 flex items-end gap-6">
          {/* Not a button: editing goes through "Modifier". */}
          <div className="relative size-48 shrink-0 overflow-hidden rounded-xl glow-accent-deep">
            <PlaylistCoverMosaic
              covers={playlistCovers(tracks)}
              customUrl={playlist.coverUrl}
              favorites={locked}
              className="size-full"
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="min-w-0">
              <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
                {t("playlists.eyebrow")}
              </p>
              <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{displayName}</h1>
              <p className="mt-1.5 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3.5">
              {tracks.length > 0 && <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />}

              {/* None for favorites: every action would rename, restyle or delete it. */}
              {!locked && (
                <div className="flex items-center gap-2">
                  <motion.button
                    type="button"
                    onClick={onEdit}
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ scale: 1.03 }}
                    transition={springs.snappy}
                    className={`${HERO_BUTTON_SECONDARY} cursor-pointer`}
                  >
                    <FilePen className="size-4" />
                    {t("edit")}
                  </motion.button>

                  <Dropdown>
                    <Dropdown.Trigger
                      aria-label={t("albums.moreActions")}
                      className={`${HERO_BUTTON_ICON} cursor-pointer data-[pressed]:bg-surface`}
                    >
                      <MoreHorizontal className="size-4 shrink-0" />
                    </Dropdown.Trigger>
                    <Dropdown.Popover placement="bottom start">
                      <Dropdown.Menu onAction={() => onDelete()}>
                        <Dropdown.Item id="delete" variant="danger" textValue={t("playlists.delete.action")}>
                          <Trash2 className="size-4" />
                          {t("playlists.delete.action")}
                        </Dropdown.Item>
                      </Dropdown.Menu>
                    </Dropdown.Popover>
                  </Dropdown>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
