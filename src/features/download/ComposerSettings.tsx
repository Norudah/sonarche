import { Disclosure } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { JobKind } from "@/features/download/api";
import { DestinationChoice, type Destination } from "@/features/download/DestinationChoice";
import { KindChoice } from "@/features/download/KindChoice";
import type { DetectedUrlKind } from "@/features/download/urlKind";
// The library's category axis, reused so the values never diverge.
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
  singleAlbum: boolean;
  onSingleAlbumChange: (on: boolean) => void;
}

/** Summary for the folded strip; empty while the choice is automatic. */
function destinationSummary(destination: Destination): string {
  if (destination.mode === "existing") return destination.target?.title ?? "";
  if (destination.mode === "new") return destination.title.trim();
  return "";
}

/**
 * The options strip under the URL field: kind and category always visible,
 * the rest folded. Opens itself when a link is recognised (unless disabled in
 * Settings), so options are discovered when they start to matter.
 */
export function ComposerSettings({
  kind,
  detected,
  onKindChange,
  category,
  onCategoryChange,
  destination,
  onDestinationChange,
  singleAlbum,
  onSingleAlbumChange,
}: ComposerSettingsProps) {
  const { t } = useTranslation("download");
  const labelOf = useCategoryLabel();
  const autoExpand = useAutoExpand("download");
  const forcedTitle = destinationSummary(destination);

  return (
    <Disclosure
      // Re-keyed so `defaultExpanded` re-applies on recognition and on preference changes.
      key={`${detected != null ? "recognised" : "idle"}:${autoExpand}`}
      defaultExpanded={autoExpand && detected != null}
      className="border-t border-separator/60 bg-panel px-3 py-2"
    >
      {/* No `Disclosure.Heading`: a radio group inside a heading would be invalid. */}
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
            {/* A forced destination leads the summary: the less expected choice. */}
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
          <DestinationChoice
            value={destination}
            kind={kind}
            onChange={onDestinationChange}
            singleAlbum={singleAlbum}
            onSingleAlbumChange={onSingleAlbumChange}
          />
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
