import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";

/** The stages, in the rail's own vocabulary — the explainer and the progress
 * bar must name the steps identically, or they read as two machines. `after`
 * is the one entry past the rail: what the import deliberately does not do,
 * and where the remedy lives. */
const STEPS = ["scan", "copy", "covers", "after"] as const;

/**
 * What pressing "Import" will actually set off, on demand.
 *
 * A disclosure rather than a paragraph: the page's lead already carries the
 * one promise that matters (originals untouched), and a wall of process text
 * above the picker would push the actual control below the fold. Whoever
 * wants the mechanics opens them; the card holds one line per stage of the
 * rail, so the vocabulary learned here is the vocabulary the progress bar
 * speaks a minute later.
 */
export function HowItWorks() {
  const { t } = useTranslation("import");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-fit cursor-pointer items-center gap-1.5 text-xs font-medium text-muted transition-colors outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {t("how.toggle")}
        <motion.span initial={false} animate={{ rotate: open ? 180 : 0 }} transition={springs.snappy} className="flex">
          <ChevronDown className="size-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.soft}
            className="overflow-hidden"
          >
            <dl className="mt-3 flex max-w-prose flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-sm">
              {STEPS.map((step) => (
                <div key={step} className="flex flex-col gap-0.5">
                  <dt className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
                    {t(`how.${step}.name`)}
                  </dt>
                  <dd className="text-[0.8125rem] leading-relaxed text-muted">{t(`how.${step}.body`)}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
