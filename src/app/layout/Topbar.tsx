import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { paths } from "@/app/routes";

/** Thin bar above the content area; will eventually replace the native macOS
 * title bar. For now it only hosts the settings entry point. */
export function Topbar() {
  const { t } = useTranslation("settings");

  return (
    <header className="flex h-10 shrink-0 items-center justify-end border-b border-separator bg-surface px-3">
      <Link
        to={paths.settings}
        aria-label={t("open")}
        className="rounded-lg p-1.5 text-muted transition-colors hover:bg-default/40 hover:text-foreground"
      >
        <Settings className="size-4" />
      </Link>
    </header>
  );
}
