import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { useCanGoBack } from "@/shared/navigation/historyDepth";

interface HeroBreadcrumbProps {
  /** Always the parent shelf, whatever route led here. */
  up: string;
  upLabel: string;
  current: string;
  label: string;
  /** Right of the trail: the view switcher. */
  actions?: ReactNode;
}

/** The hero's top line: a back chevron (session history, absent on a cold
 * entry), a link to the parent shelf, and the view switcher. */
export function HeroBreadcrumb({ up, upLabel, current, label, actions }: HeroBreadcrumbProps) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  return (
    // Below the sticky headers (z-20).
    <div className="relative z-10 flex items-center justify-between gap-4">
      <nav aria-label={label} className="flex min-w-0 items-center gap-1.5 text-[0.8125rem]">
        {canGoBack && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label={t("back")}
            className="-ml-1.5 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted outline-none transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <Link
          to={up}
          className="shrink-0 rounded-sm font-medium text-accent outline-none transition-colors hover:text-accent-hover focus-visible:ring-2 focus-visible:ring-accent/40"
        >
          {upLabel}
        </Link>
        <span className="text-muted/60">/</span>
        <span className="min-w-0 truncate text-muted">{current}</span>
      </nav>

      {actions}
    </div>
  );
}
