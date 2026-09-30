import { toast } from "@heroui/react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { classifyPlaybackError } from "@/shared/player/playbackError";

/** Reports a track that failed to play (e.g. an unsupported format) as a toast. */
export function useReportPlaybackFailure() {
  const { t } = useTranslation("player");

  return useCallback(
    (error: unknown, trackTitle: string) => {
      const failure = classifyPlaybackError(error);

      if (failure.kind === "unreadable") {
        toast.danger(t("unreadable"), { description: t("unreadableDetail", { title: trackTitle }) });
        return;
      }

      // A file may have no extension to name.
      const description = failure.extension
        ? t("unsupportedFormatDetail", { title: trackTitle, extension: failure.extension })
        : t("unsupportedFormatDetailUnknown", { title: trackTitle });

      toast.danger(t("unsupportedFormat"), { description });
    },
    [t],
  );
}
