import { toast } from "@heroui/react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { classifyPlaybackError } from "@/shared/player/playbackError";

/**
 * Say out loud that a track would not play.
 *
 * The engine used to fail into nothing: `loadTrack` caught the rejection, set
 * `isPlaying` to false, and the user was left with a pressed play button and
 * silence. Importing someone's existing library makes that unacceptable — an
 * Opus or WMA file is an ordinary thing to own, and "nothing happens" is not an
 * answer to clicking it.
 *
 * Lives beside the player rather than in a generic error-reporting layer: it
 * knows what a playback failure is and how the player names a track, and
 * nothing else does.
 */
export function useReportPlaybackFailure() {
  const { t } = useTranslation("player");

  return useCallback(
    (error: unknown, trackTitle: string) => {
      const failure = classifyPlaybackError(error);

      if (failure.kind === "unreadable") {
        toast.danger(t("unreadable"), { description: t("unreadableDetail", { title: trackTitle }) });
        return;
      }

      // No extension to name — a file called `Roygbiv` with the bytes of an
      // Opus stream. Saying ".undefined" would be worse than saying less.
      const description = failure.extension
        ? t("unsupportedFormatDetail", { title: trackTitle, extension: failure.extension })
        : t("unsupportedFormatDetailUnknown", { title: trackTitle });

      toast.danger(t("unsupportedFormat"), { description });
    },
    [t],
  );
}
