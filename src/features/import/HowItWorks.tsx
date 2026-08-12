import { useTranslation } from "react-i18next";

import { FieldHelp } from "@/shared/ui/FieldHelp";

/** The stages, in the rail's own vocabulary — the explainer and the progress
 * bar must name the steps identically, or they read as two machines. `after`
 * is the one entry past the rail: what the import deliberately does not do,
 * and where the remedy lives. */
const STEPS = ["scan", "copy", "covers", "after"] as const;

/**
 * What pressing "Import" will actually set off, on the help mark that closes
 * the lead.
 *
 * It used to be a disclosure of its own — a labelled chevron under the lead
 * that unfolded a card. Nothing else in the app explains itself that way: a
 * notion the interface can state in passing hangs off a `?` and answers on
 * hover, from the tooltip's dark slab. Same affordance as every field in the
 * metadata drawer, so a second explanation reads as the same gesture rather
 * than a second mechanism to learn.
 *
 * The four steps survive the move: they are what the progress rail is about to
 * name, and the tooltip is where that vocabulary is learned.
 */
export function HowItWorks() {
  const { t } = useTranslation("import");

  return (
    <FieldHelp
      label={t("how.label")}
      text={
        <dl className="flex flex-col gap-2">
          {STEPS.map((step) => (
            <div key={step}>
              <dt className="font-semibold">{t(`how.${step}.name`)}</dt>
              <dd className="opacity-75">{t(`how.${step}.body`)}</dd>
            </div>
          ))}
        </dl>
      }
    />
  );
}
