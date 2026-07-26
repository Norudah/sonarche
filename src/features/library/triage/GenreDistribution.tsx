import { Disclosure } from "@heroui/react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { genrePath } from "@/app/routes";
import type { Family } from "@/features/library/genres/genres";
import { useFamilyLabel } from "@/features/library/genres/useFamilyLabel";

/**
 * The family distribution, folded away by default: it is context, not part of
 * the correction queue, and unfolding it is a deliberate act. Each row is still
 * a door — it opens the family's own page, where the browsing happens.
 */
export function GenreDistribution({ families }: { families: Family[] }) {
  const { t, i18n } = useTranslation(["metadata", "library"]);
  const labelOf = useFamilyLabel();
  const percent = new Intl.NumberFormat(i18n.language, { style: "percent", maximumFractionDigits: 0 });

  if (families.length === 0) return null;

  return (
    <Disclosure>
      <Disclosure.Heading>
        <Disclosure.Trigger className="group/trigger flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl px-1 py-2 text-sm font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40">
          {t("distribution.title")}
          <Disclosure.Indicator>
            <ChevronDown className="size-4 text-muted" />
          </Disclosure.Indicator>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>
          <ul className="flex flex-col">
            {families.map((family) => (
              <li key={family.key}>
                <Link
                  to={genrePath(family.key)}
                  className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-1.5 text-sm outline-none transition-colors hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent/40"
                >
                  <span className="min-w-0 truncate">{labelOf(family.key)}</span>
                  <span className="shrink-0 text-[0.8125rem] text-muted tabular-nums">
                    {t("library:trackCount", { count: family.trackCount })} · {percent.format(family.share)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}
