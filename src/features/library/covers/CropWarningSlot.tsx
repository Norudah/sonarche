/**
 * Reserved space for the crop warnings, held open for the whole cropping
 * session: the messages come and go with the zoom, and a modal that changes
 * height every few notches reads as jitter, not guidance.
 */
export function CropWarningSlot({ active, warning }: { active: boolean; warning: string | null }) {
  if (!active) return null;
  return (
    <div className="flex min-h-9 flex-col justify-center">
      {warning != null && (
        <p className="rounded-xl border border-dashed border-warning/45 bg-warning-soft px-3 py-2 text-[0.75rem] leading-snug text-warning">
          {warning}
        </p>
      )}
    </div>
  );
}
