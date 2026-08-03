import { Disclosure } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ForcedAlbum, JobKind } from "@/features/download/api";
import { ForcedAlbumChoice } from "@/features/download/ForcedAlbumChoice";
import { KindChoice } from "@/features/download/KindChoice";
import type { DetectedUrlKind } from "@/features/download/urlKind";
// The taxonomy the composer offers is the library's own axis, and its canonical
// values must not exist twice — a second list would drift out of step with the
// one the Categories page groups by on the first addition.
import { CATEGORY_TAXONOMY } from "@/features/library/categories/categories";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";

const CHIP =
  "cursor-pointer rounded-full px-2.5 py-1 text-[0.75rem] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";
const CHIP_ON = "bg-accent text-accent-foreground";
const CHIP_OFF = "bg-surface text-muted hover:bg-surface-tertiary hover:text-foreground";

/**
 * The context axis, chosen before the download rather than corrected after it.
 *
 * "Aucune" is a chip of its own rather than un-picking the active one: leaving
 * the axis blank is a real answer here — it is what the app did until now — and
 * a choice you can only express by clicking the same thing twice is a choice
 * nobody finds.
 */
function CategoryChoice({ value, onChange }: { value: string | null; onChange: (next: string | null) => void }) {
  const { t } = useTranslation("download");
  const labelOf = useCategoryLabel();

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
        {t("options.category")}
      </legend>
      <p className="text-xs text-muted">{t("options.categoryHint")}</p>
      <div className="mt-0.5 flex flex-wrap gap-1.5">
        {CATEGORY_TAXONOMY.map((canonical) => (
          <button
            key={canonical}
            type="button"
            aria-pressed={value === canonical}
            onClick={() => onChange(canonical)}
            className={`${CHIP} ${value === canonical ? CHIP_ON : CHIP_OFF}`}
          >
            {labelOf(canonical)}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value === null}
          onClick={() => onChange(null)}
          className={`${CHIP} ${value === null ? CHIP_ON : CHIP_OFF}`}
        >
          {t("options.categoryNone")}
        </button>
      </div>
    </fieldset>
  );
}

interface ComposerSettingsProps {
  kind: JobKind;
  detected: DetectedUrlKind;
  onKindChange: (kind: JobKind) => void;
  category: string | null;
  onCategoryChange: (next: string | null) => void;
  forcedAlbum: ForcedAlbum | null;
  onForcedAlbumChange: (next: ForcedAlbum | null) => void;
}

/**
 * The bar under the URL field: everything that decides what the link becomes.
 *
 * One strip, on its own tint, so the field above stays the single thing you
 * type into. What is always worth seeing sits on the strip itself — set or
 * track, and the tag it will be filed under; the rest folds away, because the
 * defaults are right for almost every link. The summary chip stays visible when
 * folded: an option nobody can see is an option nobody trusts.
 */
export function ComposerSettings({
  kind,
  detected,
  onKindChange,
  category,
  onCategoryChange,
  forcedAlbum,
  onForcedAlbumChange,
}: ComposerSettingsProps) {
  const { t } = useTranslation("download");
  const labelOf = useCategoryLabel();
  // A single track has no playlist to gather under one name.
  const canForceAlbum = kind === "album";
  const forcedTitle = canForceAlbum ? forcedAlbum?.title.trim() : "";

  return (
    <Disclosure className="border-t border-separator/60 bg-panel px-3 py-2">
      {/* No `Disclosure.Heading`: the switch sits on the same line as the
          trigger, and a radio group nested inside a heading element is a lie
          about the document's structure. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <KindChoice value={kind} detected={detected} onChange={onKindChange} />

        <Disclosure.Trigger className="flex h-7 cursor-pointer items-center gap-3 rounded-lg px-1 text-xs font-medium text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40">
          <span className="flex items-center gap-1">
            {t("options.title")}
            <Disclosure.Indicator>
              <ChevronDown className="size-3.5" />
            </Disclosure.Indicator>
          </span>
          <span className="flex items-center gap-1">
            {/* The forced album leads the summary when there is one: it is the
                louder of the two decisions, and the one nobody expects to be on
                by accident. */}
            {forcedTitle && (
              <span className="max-w-40 truncate rounded-full bg-accent-soft px-2 py-0.5 text-[0.6875rem] font-medium text-accent">
                {forcedTitle}
              </span>
            )}
            <span className="rounded-full bg-default/70 px-2 py-0.5 text-[0.6875rem] font-medium text-foreground">
              {category ? labelOf(category) : t("options.categoryNone")}
            </span>
          </span>
        </Disclosure.Trigger>
      </div>

      <Disclosure.Content>
        <Disclosure.Body className="flex flex-col gap-4 px-1 pt-3">
          <CategoryChoice value={category} onChange={onCategoryChange} />
          <hr className="border-separator/70" />
          <ForcedAlbumChoice value={forcedAlbum} isDisabled={!canForceAlbum} onChange={onForcedAlbumChange} />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
