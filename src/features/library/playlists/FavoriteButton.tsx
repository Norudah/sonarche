import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useFavorites } from "@/features/library/playlists/hooks";
import { BAR_TRIGGER } from "@/shared/player/barTrigger";
import { usePlayer } from "@/shared/player/PlayerContext";

/**
 * The one-press way in and out of the favorites list — membership in the
 * seeded playlist, nothing more, so the heart can never disagree with the
 * playlist page about what "favorite" means. Filled accent when in; the
 * optimistic add is what makes the fill answer the click, not the round-trip.
 */
export function FavoriteButton({ itemId, className }: { itemId: number; className: string }) {
  const { t } = useTranslation("library");
  const { favorites, ids, toggle } = useFavorites();
  // Before the store answers (first paint, or a wiped install mid-reseed)
  // there is nothing to toggle against; a dead heart would read as broken.
  if (!favorites) return null;

  const active = ids.has(itemId);
  return (
    <button
      type="button"
      onClick={() => toggle(itemId)}
      aria-label={active ? t("playlists.unfavorite") : t("playlists.favorite")}
      aria-pressed={active}
      className={`${className} ${active ? "text-accent" : "hover:text-foreground"}`}
    >
      <Heart className={active ? "size-4 fill-current" : "size-4"} />
    </button>
  );
}

/**
 * The player bar's heart: favorite what is playing right now, à la Apple. The
 * bar itself lives in `shared` and cannot know about playlists, so this rides
 * in through the `accessory` slot from the app shell.
 */
export function FavoriteCurrentButton() {
  const { current } = usePlayer();
  const itemId = current == null ? null : Number(current.id);
  if (itemId == null || Number.isNaN(itemId)) return null;
  return <FavoriteButton itemId={itemId} className={BAR_TRIGGER} />;
}
