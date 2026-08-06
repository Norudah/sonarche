import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

import { allowCoverPreview } from "@/features/library/api";
import type { SourceSize } from "@/features/library/covers/coverCrop";

/** Image formats a picked replacement may arrive in — mirrors the Rust
 * whitelist (`COVER_SOURCE_EXTENSIONS`). */
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

/** A local file admitted into the asset scope, ready to preview. */
export interface LocalImage {
  path: string;
  url: string;
  bytes: number;
}

/**
 * Choosing a local image to become a square picture: the file dialog, OS
 * drag-and-drop (Tauri's own events — HTML5 drop never fires under the
 * interceptor), the preview admission, and the crop frame's state.
 *
 * Shared by the cover and artist-image modals; each keeps its own error copy,
 * so failures surface through callbacks rather than state here.
 */
export function useLocalImageSource({
  isOpen,
  filterName,
  onAdopt,
  onUnreadable,
}: {
  /** Gates the drag-and-drop subscription to the modal's lifetime. */
  isOpen: boolean;
  /** The file dialog's filter label. */
  filterName: string;
  /** A new file is about to land — clear errors/competing selections. */
  onAdopt?: () => void;
  onUnreadable: () => void;
}) {
  const [image, setImage] = useState<LocalImage | null>(null);
  const [natural, setNatural] = useState<SourceSize | null>(null);
  const [offset, setOffset] = useState(0.5);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const adopt = async (path: string) => {
    onAdopt?.();
    try {
      const admitted = await allowCoverPreview(path);
      setImage(admitted);
      setNatural(null);
      setOffset(0.5);
    } catch {
      onUnreadable();
    }
  };

  const pick = async () => {
    const chosen = await open({
      multiple: false,
      filters: [{ name: filterName, extensions: IMAGE_EXTENSIONS }],
    });
    if (typeof chosen === "string") await adopt(chosen);
  };

  const clear = () => {
    setImage(null);
    setNatural(null);
    setOffset(0.5);
    setIsDropTarget(false);
  };

  // The ref keeps the drop handler current without re-subscribing on every
  // render; the subscription itself exists exactly while the modal is up.
  const dropRef = useRef<(paths: string[]) => void>(() => {});
  dropRef.current = (paths) => {
    const dropped = paths.find((path) => IMAGE_EXTENSIONS.some((ext) => path.toLowerCase().endsWith(`.${ext}`)));
    if (dropped) void adopt(dropped);
    else onUnreadable();
  };
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/webview")
      .then(({ getCurrentWebview }) =>
        getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === "enter") setIsDropTarget(true);
          if (event.payload.type === "leave") setIsDropTarget(false);
          if (event.payload.type === "drop") {
            setIsDropTarget(false);
            dropRef.current(event.payload.paths);
          }
        }),
      )
      .then((stop) => {
        if (cancelled) stop();
        else unlisten = stop;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isOpen]);

  return { image, natural, offset, isDropTarget, pick, adopt, clear, setOffset, setNatural };
}
