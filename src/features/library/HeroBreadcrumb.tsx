import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { useCanGoBack } from "@/shared/navigation/historyDepth";

interface HeroBreadcrumbProps {
  /** Where the trail leads — always the page's parent shelf, whatever route the
   * user actually took to get here. */
  up: string;
  upLabel: string;
  /** The page you are on. Not a link — you are already here. */
  current: string;
  label: string;
  /** Right of the trail: the view switcher. A slot rather than a prop because
   * what goes there is a whole control. */
  actions?: ReactNode;
}

/**
 * The top line of every library hero: where you came from, where you are, and
 * how you are looking at it.
 *
 * Two affordances that used to be one, and were the poorer for it. The trail
 * used to double as the back button by stepping through history when a card had
 * flagged the visit, which meant it lied twice: it read "Artists" while
 * stepping back to a genre page, and it fell back to the parent shelf whenever
 * the flag was missing — which every link outside the index cards was, the
 * tracks table's artist and album cells included. Reaching an artist from a
 * filtered genre and pressing back dropped you on the Artists index with the
 * genre lost.
 *
 * So they are split by meaning. The chevron steps back through the session's
 * own history and is right whatever the route in; the trail is a plain link to
 * the parent and says what the page is *under*. The chevron is absent, not
 * disabled, when there is nothing behind — a cold entry sees the trail alone,
 * and never sees the other version to notice a shift.
 *
 * The right end of the line takes the view switcher. It is the one control that
 * is neither an action nor a filter — it says how this page is being read, and
 * that is what this line is about. It also puts it in the same place on every
 * detail page, on a line that was otherwise 90% empty.
 */
export function HeroBreadcrumb({ up, upLabel, current, label, actions }: HeroBreadcrumbProps) {
  const { t } = useTranslation("library");
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();

  return (
    // `relative z-10` so the window drag strip, which claims the page's top
    // 2rem, does not swallow this line — the hero starts at 1.25rem and this is
    // the one row that reaches under it. Same z as the strip and later in the
    // tree, so it wins; still below the sticky headers at z-20.
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
