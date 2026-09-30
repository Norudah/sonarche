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
  imageUrl: string | null;
  onPlay: () => void;
  onShuffle: () => void;
  /** Opens the edit modal. */
  onEdit: () => void;
  /** The view switcher. */
  actions?: ReactNode;
  ref?: Ref<HTMLElement>;
}

/** The album hero's counterpart: a discography span and genres instead of a
 * year and format. Only stats the library actually knows. */
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
          {/* Same 192px box as the album cover, round. Not a button: editing goes
              through "Modifier". */}
          <div className="relative size-48 shrink-0 overflow-hidden rounded-full glow-accent-deep">
            <ArtistAvatar imageUrl={imageUrl} className="size-full" />
          </div>

          {/* Capped: with nothing on the right, a full-width column looked empty. */}
          <div className="min-w-0 max-w-2xl flex-1">
            <p className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
              {t("artists.eyebrow")}
            </p>
            <h1 className="mt-1 truncate text-3xl font-semibold tracking-tight">{artist.name}</h1>
            <p className="mt-1.5 truncate text-[0.8125rem] text-muted">{meta.join(" · ")}</p>

            {/* Capped at four to stay on one row. */}
            <GenreChips
              genres={artist.genres.slice(0, 4)}
              families={genreFamilyIndex(artist.albums.flatMap((album) => album.tracks))}
            />

            {/* No delete: it would remove an unbounded number of albums. */}
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
