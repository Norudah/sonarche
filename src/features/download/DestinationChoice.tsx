import { Radio, RadioGroup, Switch } from "@heroui/react";
import { Lightbulb } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { ForcedAlbum, JobKind } from "@/features/download/api";
import { ForcedAlbumPreview } from "@/features/download/ForcedAlbumPreview";
import { AlbumSelect, type AlbumTarget } from "@/features/library/albums/AlbumSelect";
// Suggests names the library already knows, avoiding duplicate spellings.
import { SuggestInput } from "@/features/library/metadata/SuggestInput";
import { MetadataSuggestionsProvider } from "@/features/library/metadata/SuggestionsContext";
import { layoutIds, springs } from "@/shared/motion/tokens";

/** Where the download lands: `auto` (pipeline filing), an existing album, or
 * a new one. One union so modes can't leave stale half-answers. */
export type Destination =
  | { mode: "auto" }
  | { mode: "existing"; target: AlbumTarget | null }
  | { mode: "new"; title: string; artist: string | null };

export const AUTO_DESTINATION: Destination = { mode: "auto" };

/** `null` leaves filing to the pipeline; a mode with a blank answer counts as
 * automatic. */
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

/* Same pill as KindChoice, with its own layout id. */
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

/** The album a download lands on: automatic, existing, or new. Only filing
 * is forced; tracks are still identified individually. */
export function DestinationChoice({
  value,
  kind,
  onChange,
  modes = ["auto", "existing", "new"],
  singleAlbum,
  onSingleAlbumChange,
}: {
  value: Destination;
  kind: JobKind;
  onChange: (next: Destination) => void;
  /** The refile dialog omits `auto`: no pipeline is left to decide. */
  modes?: Destination["mode"][];
  /** Auto mode's "one record per playlist" toggle; composer only. */
  singleAlbum?: boolean;
  onSingleAlbumChange?: (on: boolean) => void;
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
        <div className="flex flex-col gap-2">
          <p className="text-xs leading-relaxed text-muted">{t("options.destination.autoHint")}</p>
          {kind === "album" && onSingleAlbumChange && (
            <div className="flex flex-col gap-1">
              <Switch isSelected={singleAlbum ?? true} onChange={onSingleAlbumChange} className="w-fit">
                <Switch.Content className="gap-2">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <span className="text-xs font-medium">{t("options.destination.singleAlbum")}</span>
                </Switch.Content>
              </Switch>
              <p className="max-w-[62ch] text-xs leading-relaxed text-muted">
                {t("options.destination.singleAlbumHint")}
              </p>
            </div>
          )}
        </div>
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
            /* Side by side so the fields stay in view. */
            <div className="flex flex-wrap items-start gap-x-6 gap-y-2">
              <div className="flex max-w-[52ch] flex-col gap-1.5">
                <p className="text-xs leading-relaxed text-muted">{t("options.destination.problem")}</p>
                {/* A released soundtrack is matched on its own; forcing skips that. */}
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
              {/* Mounted with the field: the suggestion pools span the whole library. */}
              <MetadataSuggestionsProvider>
                <SuggestInput
                  value={value.artist ?? ""}
                  suggest="artist"
                  // Playlists fall back to the compilation default; singles keep their artist.
                  placeholder={kind === "album" ? "Various Artists" : undefined}
                  onChange={(artist) => onChange({ ...value, artist: artist || null })}
                  className={FIELD}
                />
              </MetadataSuggestionsProvider>
            </label>
          </div>
        </div>
      )}
    </fieldset>
  );
}
