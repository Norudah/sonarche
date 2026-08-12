import { readImage, readText } from "@tauri-apps/plugin-clipboard-manager";
import { useEffect, useRef } from "react";

import { savePastedImage } from "@/features/library/api";

/**
 * The paste-an-image path: what the clipboard holds, landed where the picker
 * can adopt it. An image (a browser's "Copy image") arrives as raw RGBA from
 * the OS pasteboard — re-encoded to PNG in the webview, persisted by Rust as a
 * temp file with the same admission as a pasted link. A copied image *address*
 * routes to the link fetch instead, so one paste gesture covers both.
 */
export type ClipboardContent =
  { kind: "image"; path: string } | { kind: "url"; url: string } | { kind: "oversized" } | { kind: "none" };

// Refused outright: the pasteboard hands the image over as raw RGBA, four
// bytes a pixel — past this the copy alone is a memory spike (48 MP ≈ 192 MB).
const MAX_PASTE_PIXELS = 48_000_000;

// Downscaled to this side before encoding: the rendition pipeline caps at
// 500 px anyway, and 4096 keeps the PNG hop and the archive generous without
// ever encoding a wall-sized screenshot at full size.
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

/** Read the clipboard once: an image beats a link, a link beats nothing.
 * Throws when an image was there but could not be decoded or saved. */
export async function readClipboardContent(): Promise<ClipboardContent> {
  const image = await readImage().catch(() => null);
  if (image) {
    try {
      // Size first: refusing an outsized image must not cost pulling its
      // whole RGBA body across the IPC boundary.
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

/** The platform's paste chord, for display. */
export const PASTE_CHORD = navigator.platform.toLowerCase().includes("mac") ? "⌘V" : "Ctrl+V";

/** ⌘V / Ctrl+V anywhere in the open modal triggers the clipboard read — except
 * over an editable field, where the native paste must keep working. */
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
