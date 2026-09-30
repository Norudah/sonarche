import { useEffect, useState } from "react";

import { cropRect, type CropFrame, type SourceSize } from "@/features/library/covers/coverCrop";
import type { LocalImage } from "@/features/library/covers/useLocalImageSource";

/** A cover's weight in binary units, one decimal below 100. */
export function formatWeight(bytes: number, locale: string, mb: string, kb: string): string {
  const format = (value: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
  return bytes >= 1_048_576 ? `${format(bytes / 1_048_576)} ${mb}` : `${format(Math.max(1, bytes / 1024))} ${kb}`;
}

/** Estimated weight of the 500px embedded rendition, by encoding in the
 * webview. The canvas may be tainted (CORS), so failure is possible. */
async function estimateEmbeddedBytes(
  url: string,
  crop: { left: number; top: number; size: number },
  isPng: boolean,
): Promise<number | null> {
  try {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = url;
    await image.decode();
    const side = Math.min(500, crop.size);
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, crop.left, crop.top, crop.size, crop.size, 0, 0, side, side);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, isPng ? "image/png" : "image/jpeg", 0.92),
    );
    return blob?.size ?? null;
  } catch {
    return null;
  }
}

/** The embedded rendition's estimated weight for the framed image, or null
 * while unknown. Re-estimated after the frame settles, not on every keypress. */
export function useEmbeddedEstimate(
  image: LocalImage | null,
  natural: SourceSize | null,
  frame: CropFrame,
): number | null {
  const [estimate, setEstimate] = useState<{ url: string; bytes: number | null } | null>(null);

  useEffect(() => {
    if (!image || !natural) return;
    const crop = cropRect(natural, frame) ?? { left: 0, top: 0, size: natural.width };
    let stale = false;
    const timer = window.setTimeout(async () => {
      const bytes = await estimateEmbeddedBytes(image.url, crop, image.path.toLowerCase().endsWith(".png"));
      if (!stale) setEstimate({ url: image.url, bytes });
    }, 250);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [image, natural, frame]);

  // An estimate made for a previous image says nothing about this one.
  return image && estimate?.url === image.url ? estimate.bytes : null;
}
