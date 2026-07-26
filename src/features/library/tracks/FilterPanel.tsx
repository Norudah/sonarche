import { Popover } from "@heroui/react";
import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { barPill } from "@/features/library/barPill";
import type { TrackFilterState } from "@/features/library/tracks/useTrackFilter";
import { GENRE_MISSING, GENRE_OFF_TREE } from "@/features/library/tracks/triage";

/**
 * Amber when on, for the app's one rule about this colour: a correction filter
 * means "something to fix" — the wash the Metadata queue's doors wear — while
 * indigo is the colour of browsing. The decade is browsing; the rest are not.
 */
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

/** Active filters that live in here rather than behind a pill of their own. The
 * count is what tints the trigger; the chips beside it spell them out, so the
 * trigger deliberately carries no number of its own. */
function panelFilterCount(state: TrackFilterState): number {
  const { triage } = state;
  return [
    triage.decade != null,
    triage.missingYear,
    triage.genre === GENRE_MISSING || triage.genre === GENRE_OFF_TREE,
    triage.suspectMatch,
    triage.duplicateRecording,
  ].filter(Boolean).length;
}

/**
 * The bar's overflow: the axes that do not deserve a permanent pill.
 *
 * Two kinds live here, and the colours say which is which. The decade is the one
 * browsing axis no other page in the app covers — a timeline, so chips rather
 * than a menu, since reading 1990 next to 2020 is the point. The rest are the
 * triage deep links the Metadata page already produces, exposed by hand: the
 * explorer could always *arrive* filtered on them and never set one itself.
 *
 * Chips and not checkboxes because the app already speaks in chips — the genre
 * chips, the triage chips — and a form control here would have been the only one
 * of its kind in the library.
 */
export function FilterPanel({ state }: { state: TrackFilterState }) {
  const { t } = useTranslation("library");
  const { triage, facets, axes, setParam } = state;

  const active = panelFilterCount(state);
  // The two sentinels ride the same `?genre=` param as a real genre name, so a
  // page that does not own that axis cannot offer them.
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
