import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useFavorites } from "@/features/library/playlists/hooks";
import { BAR_TRIGGER } from "@/shared/player/barTrigger";
import { usePlayer } from "@/shared/player/PlayerContext";

/** Toggles membership in the favorites playlist, optimistically. */
export function FavoriteButton({ itemId, className }: { itemId: number; className: string }) {
  const { t } = useTranslation("library");
  const { favorites, ids, toggle } = useFavorites();
  // Nothing to toggle against until the store answers.
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

/** The player bar's heart, passed through its `accessory` slot by the shell. */
export function FavoriteCurrentButton() {
  const { current } = usePlayer();
  const itemId = current == null ? null : Number(current.id);
  if (itemId == null || Number.isNaN(itemId)) return null;
  return <FavoriteButton itemId={itemId} className={BAR_TRIGGER} />;
}
