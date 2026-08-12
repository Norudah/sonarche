import { Disclosure } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import { DestinationChoice, type Destination } from "@/features/download/DestinationChoice";
import { KindChoice } from "@/features/download/KindChoice";
import type { DetectedUrlKind } from "@/features/download/urlKind";
// The taxonomy the composer offers is the library's own axis, and its canonical
// values must not exist twice — a second list would drift out of step with the
// one the Categories page groups by on the first addition.
import { CategoryChoice } from "@/features/library/categories/CategoryChoice";
import { useCategoryLabel } from "@/features/library/categories/useCategoryLabel";
import { useAutoExpand } from "@/shared/lib/optionPanels";

interface ComposerSettingsProps {
  kind: JobKind;
  detected: DetectedUrlKind;
  onKindChange: (kind: JobKind) => void;
  category: string | null;
  onCategoryChange: (next: string | null) => void;
  destination: Destination;
  onDestinationChange: (next: Destination) => void;
}

/** What the folded strip can say about the destination — the picked album's
 * title, the typed one, or nothing while the choice is still automatic. */
function destinationSummary(destination: Destination): string {
  if (destination.mode === "existing") return destination.target?.title ?? "";
  if (destination.mode === "new") return destination.title.trim();
  return "";
}

/**
 * The bar under the URL field: everything that decides what the link becomes.
 *
 * One strip, on its own tint, so the field above stays the single thing you
 * type into. What is always worth seeing sits on the strip itself — set or
 * track, and the tag it will be filed under; the rest folds away, because the
 * defaults are right for almost every link. The summary chip stays visible when
 * folded: an option nobody can see is an option nobody trusts.
 *
 * The panel opens itself the moment a link is recognised — the same
 * data-driven reveal as the import options on a scanned folder. Options only a
 * chevron ever surfaced were options nobody knew existed; a recognised link is
 * the moment they are about to matter. Folding it back stays the user's call
 * for as long as that link is in the field, and someone who has made that call
 * a hundred times can settle it for good in Settings — the reveal is a good
 * default, not a conviction.
 */
export function ComposerSettings({
  kind,
  detected,
  onKindChange,
  category,
  onCategoryChange,
  destination,
  onDestinationChange,
}: ComposerSettingsProps) {
  const { t } = useTranslation("download");
  const labelOf = useCategoryLabel();
  const autoExpand = useAutoExpand("download");
  const forcedTitle = destinationSummary(destination);

  return (
    <Disclosure
      // Re-keyed on recognition so `defaultExpanded` gets to answer again:
      // pasting a link opens the panel, clearing the field folds it back. The
      // preference is in the key too, so flipping the switch in Settings shows
      // on the composer at once instead of after the next paste.
      key={`${detected != null ? "recognised" : "idle"}:${autoExpand}`}
      defaultExpanded={autoExpand && detected != null}
      className="border-t border-separator/60 bg-panel px-3 py-2"
    >
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
            {/* The destination leads the summary when there is one: it is the
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
          <CategoryChoice
            value={category}
            label={t("options.category")}
            hint={t("options.categoryHint")}
            noneLabel={t("options.categoryNone")}
            onChange={onCategoryChange}
          />
          <hr className="border-separator/70" />
          <DestinationChoice value={destination} kind={kind} onChange={onDestinationChange} />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
