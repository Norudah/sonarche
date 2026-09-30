import { Popover } from "@heroui/react";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { barPill } from "@/features/library/barPill";
import type { TrackFilterState } from "@/features/library/tracks/useTrackFilter";
import { GENRE_MISSING, GENRE_OFF_TREE } from "@/features/library/tracks/triage";

/** Amber for correction filters, indigo for browsing (the decade). */
const TONE = {
  browse: "bg-accent text-accent-foreground",
  fix: "bg-warning-soft font-medium text-warning",
} as const;

function ToggleChip({
  isActive,
  tone,
  onPress,
  children,
}: {
  isActive: boolean;
  tone: keyof typeof TONE;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      onClick={onPress}
      className={
        "cursor-pointer rounded-full px-3 py-1 text-[0.8125rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 " +
        (isActive ? TONE[tone] : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground")
      }
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold tracking-widest text-muted/70 uppercase">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/** Active filters inside the panel; tints the trigger. */
function panelFilterCount(state: TrackFilterState): number {
  const { triage } = state;
  return [
    triage.decade != null,
    triage.missingYear,
    triage.missingTrackNumber,
    triage.genre === GENRE_MISSING || triage.genre === GENRE_OFF_TREE,
    triage.suspectMatch,
    triage.duplicateRecording,
  ].filter(Boolean).length;
}

/** Secondary axes: the decade (chips, a timeline) and the triage filters the
 * Metadata page links to, now settable by hand. */
export function FilterPanel({ state }: { state: TrackFilterState }) {
  const { t } = useTranslation("library");
  const { triage, facets, axes, setParam } = state;

  const active = panelFilterCount(state);
  // The genre sentinels share `?genre=`, so only pages owning that axis offer them.
  const ownsGenre = axes.includes("genre");
  const toggleGenre = (sentinel: string) => setParam("genre", triage.genre === sentinel ? null : sentinel);

  return (
    <Popover>
      <Popover.Trigger className={barPill(active > 0)} aria-label={t("filters.more")}>
        <SlidersHorizontal className={"size-3.5 " + (active > 0 ? "" : "text-muted")} />
        {t("filters.more")}
      </Popover.Trigger>

      <Popover.Content placement="bottom start">
        <Popover.Dialog className="flex w-[22rem] flex-col gap-4 p-4 outline-none">
          {facets.decades.length > 0 && (
            <Section title={t("filters.decade")}>
              {facets.decades.map((decade) => (
                <ToggleChip
                  key={decade.value}
                  tone="browse"
                  isActive={triage.decade === decade.value}
                  onPress={() => setParam("decade", triage.decade === decade.value ? null : String(decade.value))}
                >
                  {t("filters.decadeValue", { decade: decade.value })}
                  <span className="ml-1.5 tabular-nums opacity-60">{decade.trackCount}</span>
                </ToggleChip>
              ))}
            </Section>
          )}

          <Section title={t("filters.toFix")}>
            <ToggleChip
              tone="fix"
              isActive={triage.missingYear}
              onPress={() => setParam("missing", triage.missingYear ? null : "year")}
            >
              {t("triage.missingYear")}
            </ToggleChip>
            {/* Shares the `missing` param with the year, so they're exclusive. */}
            <ToggleChip
              tone="fix"
              isActive={triage.missingTrackNumber}
              onPress={() => setParam("missing", triage.missingTrackNumber ? null : "track")}
            >
              {t("triage.missingTrackNumber")}
            </ToggleChip>
            {ownsGenre && (
              <>
                <ToggleChip
                  tone="fix"
                  isActive={triage.genre === GENRE_MISSING}
                  onPress={() => toggleGenre(GENRE_MISSING)}
                >
                  {t("triage.genreMissing")}
                </ToggleChip>
                <ToggleChip
                  tone="fix"
                  isActive={triage.genre === GENRE_OFF_TREE}
                  onPress={() => toggleGenre(GENRE_OFF_TREE)}
                >
                  {t("triage.genreOffTree")}
                </ToggleChip>
              </>
            )}
            <ToggleChip
              tone="fix"
              isActive={triage.suspectMatch}
              onPress={() => setParam("suspect", triage.suspectMatch ? null : "match")}
            >
              {t("triage.suspectMatch")}
            </ToggleChip>
            <ToggleChip
              tone="fix"
              isActive={triage.duplicateRecording}
              onPress={() => setParam("duplicates", triage.duplicateRecording ? null : "recording")}
            >
              {t("triage.duplicateRecording")}
            </ToggleChip>
          </Section>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
}
