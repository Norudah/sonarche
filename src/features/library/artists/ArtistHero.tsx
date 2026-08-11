import { FilePen } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { ArtistAvatar } from "@/features/library/artists/ArtistAvatar";
import type { Artist } from "@/features/library/artists/artists";
import { GenreChips } from "@/features/library/GenreChips";
import { genreFamilyIndex } from "@/features/library/genres/genres";
import { HeroBreadcrumb } from "@/features/library/HeroBreadcrumb";
import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";
import { HeroPlayButtons } from "@/features/library/HeroPlayButtons";
import { HeroWash } from "@/features/library/HeroWash";
import { springs } from "@/shared/motion/tokens";

interface ArtistHeroProps {
  artist: Artist;
  /** The artist's own picture, when they have one. */
  imageUrl: string | null;
  onPlay: () => void;
  onShuffle: () => void;
  /** Opens the artist's edit modal, from the "Modifier" button. */
  onEdit: () => void;
  /** The view switcher, in the same spot as on the genre and category heroes. */
  actions?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/**
 * The album hero's twin — same band, same wash, same baseline. Only the payload
 * differs: a discography span and genres where the album shows a year and a
 * format.
 *
 * The stats stay strictly to what the library actually knows. There is no
 * "3 h 42 of listening this month" line here, and there will not be one until a
 * play counter exists; a hero that states a number nothing measures is worse
 * than a hero that states less.
 */
export function ArtistHero({ artist, imageUrl, onPlay, onShuffle, onEdit, actions, ref }: ArtistHeroProps) {
  const { t } = useTranslation("library");

  const span =
    artist.span == null
      ? null
      : artist.span.from === artist.span.to
        ? String(artist.span.from)
        : `${artist.span.from} – ${artist.span.to}`;

  const meta = [
    t("albumCount", { count: artist.albums.length }),
    t("trackCount", { count: artist.trackCount }),
    span,
  ].filter(Boolean);

  return (
    <header ref={ref} className="relative -mx-8 -mt-5 -mb-2 px-8 pt-5 pb-7">
      <HeroWash />

      <div className="relative">
        <HeroBreadcrumb
          label={t("breadcrumb")}
          up={paths.libraryArtists}
          upLabel={t("artists.back")}
          current={artist.name}
          actions={actions}
        />

        <div className="mt-5 flex items-end gap-6">
          {/* Matches the album hero's 192px cover box, as a circle: the two
           * heroes share one baseline, the shape is the only tell of which one
           * you are on.
           *
           * Not a button any more. This page is for finding something to play,
           * and a portrait that swallowed a click into an editor was a trapdoor
           * in a corridor — worse, it was the *only* door to that editor, so
           * the one thing changeable here hid in the one place nobody presses.
           * "Modifier", below, carries it now: the app has a single word for
           * "this opens a form", and it is that one. */}
          <div className="relative size-48 shrink-0 overflow-hidden rounded-full glow-accent-deep">
            <ArtistAvatar family={artist.family} imageUrl={imageUrl} className="size-full" />
          </div>

          {/* Capped rather than stretched: the album's text column is bounded on
           * its right by the completeness ring, so it never looks empty. This
           * hero has no such right-hand anchor, and a full-width `flex-1` column
           * left its short title and stats floating in a half-blank band. The
           * cap keeps them a tight block and turns the rest into clean margin. */}
          <div className="min-w-0 max-w-2xl flex-1">
            <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
              {t("artists.eyebrow")}
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{artist.name}</h1>
            <p className="mt-1.5 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>

            {/* Capped at four: an artist spanning six genres would otherwise
             * push a second row of chips into the band. The album shows all of
             * its own, which are far fewer. */}
            <GenreChips
              genres={artist.genres.slice(0, 4)}
              families={genreFamilyIndex(artist.albums.flatMap((album) => album.tracks))}
            />

            {/* In the band, like the album's action row: a lone play button
             * under a full-bleed hero reads as orphaned, and the two pages
             * should answer "how do I start this" in the same place.
             *
             * No delete action, unlike the album page. "Delete this artist"
             * would wipe an unbounded number of albums behind one click, and
             * nothing here makes that scope visible before it happens. */}
            <div className="mt-5 flex flex-wrap items-center gap-3.5">
              <HeroPlayButtons onPlay={onPlay} onShuffle={onShuffle} />

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
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
