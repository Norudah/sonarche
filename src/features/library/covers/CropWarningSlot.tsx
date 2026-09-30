/** Space reserved for crop warnings during the whole session, so the modal
 * doesn't change height as they come and go. */
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
