import { Radio, RadioGroup } from "@heroui/react";
import { Lightbulb } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ForcedAlbum, JobKind } from "@/features/download/api";
import { ForcedAlbumPreview } from "@/features/download/ForcedAlbumPreview";
import { AlbumSelect, type AlbumTarget } from "@/features/library/albums/AlbumSelect";
import { layoutIds, springs } from "@/shared/motion/tokens";

/**
 * Where the download must land, as the user sees it. `auto` is the pipeline's
 * own filing; the two others force it — onto a record already on the shelf, or
 * onto one named on the spot. One state for the whole control so switching
 * modes can never leave two half-answers armed at once.
 */
export type Destination =
  | { mode: "auto" }
  | { mode: "existing"; target: AlbumTarget | null }
  | { mode: "new"; title: string; artist: string | null };

export const AUTO_DESTINATION: Destination = { mode: "auto" };

/** What the request should carry: null is "leave the pipeline alone", and
 * anything else is a promise to overwrite the filing. A mode whose answer is
 * still blank — no album picked, no title typed — is the automatic path, not
 * a rejected download. Pure, so the promise is testable on its own. */
export function toForcedAlbum(destination: Destination): ForcedAlbum | null {
  if (destination.mode === "existing" && destination.target) {
    return {
      title: destination.target.title,
      artist: destination.target.artist,
      albumId: destination.target.albumId,
    };
  }
  if (destination.mode === "new" && destination.title.trim()) {
    return { title: destination.title.trim(), artist: destination.artist?.trim() || null };
  }
  return null;
}

const FIELD =
  "w-full rounded-xl border border-separator bg-surface px-3 py-2 text-[0.8125rem] text-foreground outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:ring-2 focus:ring-accent/25";

/* The composer's segmented grammar, one line under KindChoice — same pill,
 * its own layout id so the two markers never tween into each other. */
const SEGMENT = "relative mt-0 rounded-full";
const SEGMENT_CONTENT =
  "relative gap-1.5 px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors " +
  "text-muted hover:text-foreground data-[selected]:text-accent";

function Segment({ mode, selected, children }: { mode: Destination["mode"]; selected: string; children: ReactNode }) {
  return (
    <Radio.Root value={mode} className={SEGMENT}>
      {selected === mode && (
        <motion.span
          layoutId={layoutIds.destinationChoice}
          transition={springs.snappy}
          className="absolute inset-0 rounded-full bg-surface shadow-xs"
        />
      )}
      <Radio.Content className={SEGMENT_CONTENT}>{children}</Radio.Content>
    </Radio.Root>
  );
}

/**
 * The album a download lands on, decided before it starts.
 *
 * A film's music is a record in the listener's head and a dozen unrelated
 * releases in MusicBrainz; a lone track someone loves may belong, to them, on
 * an album they curate. Both are the same decision — where does this file —
 * so they share one control: automatic, an existing album of the library, or
 * a new one named here. Only the filing is forced; titles, artists and genres
 * are still looked up per track.
 */
export function DestinationChoice({
  value,
  kind,
  onChange,
  modes = ["auto", "existing", "new"],
}: {
  value: Destination;
  /** Playlist or single — the wording and the diagram follow. */
  kind: JobKind;
  onChange: (next: Destination) => void;
  /** The offered modes. The composer offers all three; the after-the-fact
   * "change the destination" dialog drops `auto` — there is no pipeline left
   * to decide anything. */
  modes?: Destination["mode"][];
}) {
  const { t } = useTranslation("download");

  const select = (mode: Destination["mode"]) => {
    if (mode === value.mode) return;
    onChange(
      mode === "auto" ? { mode } : mode === "existing" ? { mode, target: null } : { mode, title: "", artist: null },
    );
  };

  return (
    <fieldset className="flex flex-col gap-2">
      <span className="text-[0.8125rem] font-semibold">{t("options.destination.legend")}</span>

      <RadioGroup
        value={value.mode}
        onChange={(next) => select(next as Destination["mode"])}
        aria-label={t("options.destination.legend")}
        className="flex w-fit flex-row gap-0.5 rounded-full bg-default/60 p-0.5"
      >
        {modes.includes("auto") && (
          <Segment mode="auto" selected={value.mode}>
            {t("options.destination.modeAuto")}
          </Segment>
        )}
        {modes.includes("existing") && (
          <Segment mode="existing" selected={value.mode}>
            {t("options.destination.modeExisting")}
          </Segment>
        )}
        {modes.includes("new") && (
          <Segment mode="new" selected={value.mode}>
            {t("options.destination.modeNew")}
          </Segment>
        )}
      </RadioGroup>

      {value.mode === "auto" && (
        <p className="text-xs leading-relaxed text-muted">{t("options.destination.autoHint")}</p>
      )}

      {value.mode === "existing" && (
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-muted">{t("options.destination.existingHint")}</p>
          <AlbumSelect value={value.target} onChange={(target) => onChange({ mode: "existing", target })} />
        </div>
      )}

      {value.mode === "new" && (
        <div className="flex flex-col gap-2">
          {kind === "album" ? (
            /* Prose and picture side by side: stacked, the explanation pushed
               the fields a screenful down for an option most downloads never
               need. The diagram sits at its natural width. */
            <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
              <div className="flex max-w-[52ch] flex-col gap-1.5">
                <p className="text-xs leading-relaxed text-muted">{t("options.destination.problem")}</p>
                {/* The load-bearing correction: a released soundtrack is
                    matched on its own, and forcing one skips that. */}
                <p className="flex items-start gap-1.5 text-xs leading-relaxed text-muted">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  <span>{t("options.destination.tryWithout")}</span>
                </p>
              </div>
              <ForcedAlbumPreview isOn />
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted">{t("options.destination.newSingleHint")}</p>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex min-w-0 flex-[1.4] flex-col gap-1">
              <span className="text-[0.75rem] font-medium text-muted">{t("options.destination.title")}</span>
              <input
                type="text"
                value={value.title}
                autoFocus
                placeholder={t("options.destination.titlePlaceholder")}
                onChange={(event) => onChange({ ...value, title: event.target.value })}
                className={FIELD}
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[0.75rem] font-medium text-muted">{t("options.destination.artist")}</span>
              <input
                type="text"
                value={value.artist ?? ""}
                // A playlist with no named artist falls back to the sidecar's
                // compilation default; a single keeps its own artist.
                placeholder={kind === "album" ? "Various Artists" : undefined}
                onChange={(event) => onChange({ ...value, artist: event.target.value || null })}
                className={FIELD}
              />
            </label>
          </div>
        </div>
      )}
    </fieldset>
  );
}
