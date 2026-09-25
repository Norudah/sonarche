import { readImage, readText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useRef } from "react";

import { savePastedImage } from "@/features/library/api";

/** Clipboard content for image pickers: an image (raw RGBA from the OS,
 * re-encoded to PNG, saved by Rust) or an image URL (fetched like a link). */
type ClipboardContent =
  { kind: "image"; path: string } | { kind: "url"; url: string } | { kind: "oversized" } | { kind: "none" };

// Raw RGBA is 4 bytes a pixel: 48 MP ≈ 192 MB.
const MAX_PASTE_PIXELS = 48_000_000;

// Downscaled before encoding; the rendition caps at 500px anyway.
const MAX_PASTE_SIDE = 4096;

async function pngBytes(rgba: Uint8Array, width: number, height: number): Promise<Uint8Array> {
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  const scale = MAX_PASTE_SIDE / Math.max(width, height);
  if (scale < 1) {
    const scaled = document.createElement("canvas");
    scaled.width = Math.round(width * scale);
    scaled.height = Math.round(height * scale);
    const scaledContext = scaled.getContext("2d");
    if (!scaledContext) throw new Error("no 2d context");
    scaledContext.drawImage(canvas, 0, 0, scaled.width, scaled.height);
    canvas = scaled;
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("png encode failed");
  return new Uint8Array(await blob.arrayBuffer());
}

/** An image beats a link, a link beats nothing. Throws if an image can't be
 * decoded or saved. */
export async function readClipboardContent(): Promise<ClipboardContent> {
  const image = await readImage().catch(() => null);
  if (image) {
    try {
      // Check the size before pulling the RGBA body over IPC.
      const size = await image.size();
      if (size.width * size.height > MAX_PASTE_PIXELS) return { kind: "oversized" };
      const rgba = await image.rgba();
      const saved = await savePastedImage(await pngBytes(new Uint8Array(rgba), size.width, size.height));
      return { kind: "image", path: saved.path };
    } finally {
      void image.close().catch(() => {});
    }
  }
  const text = (await readText().catch(() => "")).trim();
  if (/^https?:\/\/\S+$/i.test(text)) return { kind: "url", url: text };
  return { kind: "none" };
}

export const PASTE_CHORD = navigator.platform.toLowerCase().includes("mac") ? "⌘V" : "Ctrl+V";

/** ⌘V / Ctrl+V in the open modal, except over editable fields. */
export function usePasteShortcut(active: boolean, onPaste: () => void) {
  const pasteRef = useRef(onPaste);
  pasteRef.current = onPaste;
  useEffect(() => {
    if (!active) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "v" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      pasteRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active]);
}
