import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { paths } from "@/app/routes";
import { ActionLink } from "@/shared/ui/ActionLink";
import { EmptyState } from "@/shared/ui/EmptyState";

/**
 * A library surface with nothing in it yet.
 *
 * Every shelf — albums, artists, genres, the track list, the metadata post —
 * is empty for the same reason and has the same two ways out, so the pair of
 * links is written once here. Only the sleeve and the sentence change, because
 * only they know what shelf the user is standing in front of.
 *
 * Both entry points, not just the download: the ark is filled from a link *or*
 * from a folder someone already has, and a first-run screen that mentions one
 * of them is a screen that hides the other.
 */
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
