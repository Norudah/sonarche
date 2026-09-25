import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { ActionLink } from "@/shared/ui/ActionLink";
import { EmptyState } from "@/shared/ui/EmptyState";

/** An empty library surface, with links to both ways in: download and import. */
export function EmptyLibrary({ icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  const { t } = useTranslation("library");

  return (
    <EmptyState
      icon={icon}
      title={title}
      body={body}
      action={
        <>
          <ActionLink to={paths.download} trailingIcon={ArrowRight}>
            {t("goToDownload")}
          </ActionLink>
          <ActionLink to={paths.import} tone="muted">
            {t("goToImport")}
          </ActionLink>
        </>
      }
    />
  );
}
