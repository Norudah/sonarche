import { useTranslation } from "react-i18next";

import { FieldHelp } from "@/shared/ui/FieldHelp";

/** Same vocabulary as the progress rail. `after` is what the import doesn't do. */
const STEPS = ["scan", "copy", "covers", "after"] as const;

/** Tooltip explaining the import steps, on the help mark ending the lead. */
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
