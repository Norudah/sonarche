import { Modal } from "@heroui/react";

import type { LibraryTrack } from "@/features/library/api";
import type { Playlist } from "@/features/library/playlists/api";
import { PlaylistImageStep } from "@/features/library/playlists/PlaylistImageStep";

/**
 * The picking room, laid over the edit dialog rather than replacing it.
 *
 * Its backdrop is a hairline of dim, not a full veil: the form underneath is
 * already sitting on one, and two veils stacked would push it into the dark
 * and read as "that window is gone" — which is exactly what the layering is
 * here to avoid. What separates the two is the width difference and the
 * shadow, not more black.
 */
export function PlaylistImageModal({
  playlist,
  tracks,
  isOpen,
  onClose,
}: {
  playlist: Playlist;
  /** Members resolved against the library, for the mosaic on the left. */
  tracks: LibraryTrack[];
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(nowOpen) => {
        if (!nowOpen) onClose();
      }}
    >
      <Modal.Backdrop className="bg-black/25">
        <Modal.Container>
          <Modal.Dialog className="flex max-h-[92vh] w-[46rem] max-w-[95vw] flex-col rounded-2xl p-0! shadow-2xl">
            {isOpen && <PlaylistImageStep playlist={playlist} tracks={tracks} onClose={onClose} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
