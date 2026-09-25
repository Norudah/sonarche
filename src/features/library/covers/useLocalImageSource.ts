import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";

import { allowCoverPreview } from "@/features/library/api";
import { WHOLE_FRAME, type CropFrame, type SourceSize } from "@/features/library/covers/coverCrop";

/** Mirrors the Rust whitelist (`COVER_SOURCE_EXTENSIONS`). */
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

/** A local file admitted to the asset scope. */
export interface LocalImage {
  path: string;
  url: string;
  bytes: number;
}

/** Local image picking for the image modals: file dialog, Tauri drag-and-drop
 * (HTML5 drop doesn't fire), preview admission and crop state. Errors go
 * through callbacks. */
export function useLocalImageSource({
  isOpen,
  filterName,
  onAdopt,
  onUnreadable,
}: {
  /** Scopes the drag-and-drop subscription to the modal. */
  isOpen: boolean;
  filterName: string;
  /** Clears errors and competing selections. */
  onAdopt?: () => void;
  onUnreadable: () => void;
}) {
  const [image, setImage] = useState<LocalImage | null>(null);
  const [natural, setNatural] = useState<SourceSize | null>(null);
  const [frame, setFrame] = useState<CropFrame>(WHOLE_FRAME);
  const [isDropTarget, setIsDropTarget] = useState(false);

  const adopt = async (path: string) => {
    onAdopt?.();
    try {
      const admitted = await allowCoverPreview(path);
      setImage(admitted);
      setNatural(null);
      setFrame(WHOLE_FRAME);
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
    setFrame(WHOLE_FRAME);
    setIsDropTarget(false);
  };

  // Keeps the drop handler current without re-subscribing.
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

  return { image, natural, frame, isDropTarget, pick, adopt, clear, setFrame, setNatural };
}
