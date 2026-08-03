import { Switch } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { ForcedAlbum } from "@/features/download/api";

/** The default the sidecar applies when the user names no album artist. Shown
 * as the field's placeholder so the fallback is visible before it happens. */
const DEFAULT_ARTIST = "Various Artists";

const FIELD =
  "w-full rounded-xl border border-separator bg-surface px-3 py-2 text-[0.8125rem] text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-55";

/**
 * One album for the whole playlist, whatever its tracks turn out to be.
 *
 * A film's music is a record in the listener's head and a dozen unrelated
 * releases in MusicBrainz. Left alone the pipeline is right and useless: twelve
 * correctly identified tracks, filed under twelve albums, and the record the
 * user wanted nowhere. This is where they say otherwise.
 *
 * Only the filing is forced. Titles, artists and genres are still looked up per
 * track — the artist column stays true, which is the whole reason the album name
 * is the only thing worth overriding.
 *
 * Off by default, and the fields only exist once it is on: an empty pair of text
 * inputs sitting under every download would suggest the normal path needs them.
 */
export function ForcedAlbumChoice({
  value,
  isDisabled,
  onChange,
}: {
  /** The forced album, or null when the toggle is off. */
  value: ForcedAlbum | null;
  /** A single track has no playlist to gather, so there is nothing to force. */
  isDisabled?: boolean;
  onChange: (next: ForcedAlbum | null) => void;
}) {
  const { t } = useTranslation("download");
  const isOn = value != null;

  return (
    <fieldset className="flex flex-col gap-1.5">
      <Switch
        isSelected={isOn}
        isDisabled={isDisabled}
        onChange={(next) => onChange(next ? { title: "", artist: null } : null)}
        className="w-full"
      >
        <Switch.Content className="w-full flex-row-reverse justify-between gap-3">
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <span className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
            {t("options.forcedAlbum.legend")}
          </span>
        </Switch.Content>
      </Switch>

      <p className="text-xs text-muted">
        {isDisabled ? t("options.forcedAlbum.singleHint") : t("options.forcedAlbum.hint")}
      </p>

      {isOn && !isDisabled && (
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <label className="flex min-w-0 flex-[1.4] flex-col gap-1">
            <span className="text-[0.75rem] font-medium text-muted">{t("options.forcedAlbum.title")}</span>
            <input
              type="text"
              value={value.title}
              autoFocus
              placeholder={t("options.forcedAlbum.titlePlaceholder")}
              onChange={(event) => onChange({ ...value, title: event.target.value })}
              className={FIELD}
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[0.75rem] font-medium text-muted">{t("options.forcedAlbum.artist")}</span>
            <input
              type="text"
              value={value.artist ?? ""}
              placeholder={DEFAULT_ARTIST}
              onChange={(event) => onChange({ ...value, artist: event.target.value || null })}
              className={FIELD}
            />
          </label>
        </div>
      )}
    </fieldset>
  );
}
