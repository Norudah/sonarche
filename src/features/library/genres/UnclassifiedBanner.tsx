import { ArrowRight, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";

/**
 * The one "family" that is not a place to browse but a problem to fix. Giving
 * it a card would dress it up as a shelf, so it sits under the grid as the
 * app's amber — the colour that already means "metadata missing" — and leads
 * where the fixing happens.
 */
export function UnclassifiedBanner({ count }: { count: number }) {
  const { t } = useTranslation("library");

  return (
    <Link
      to={paths.metadata}
      className="group/banner flex items-center gap-3 rounded-xl bg-warning-soft px-4 py-3 outline-none transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <TriangleAlert className="size-4 shrink-0 text-warning" />
      <span className="flex-1 text-[0.8125rem]">{t("genres.unclassifiedCount", { count })}</span>
      <span className="flex items-center gap-1.5 text-[0.8125rem] font-medium text-warning">
        {t("genres.fixInMetadata")}
        <ArrowRight className="size-3.5 transition-transform group-hover/banner:translate-x-0.5" />
      </span>
    </Link>
  );
}
