import { Spinner } from "@heroui/react";
import { Link2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchImageUrl } from "@/features/library/api";

/**
 * The paste-a-link path shared by the cover and artist-image modals: the user
 * pastes, the sidecar downloads (https only, size cap, magic-byte sniff), and
 * the fetched file joins the exact local-pick flow — same admission, same crop.
 */
export function ImageUrlField({
  disabled = false,
  onFetched,
  onError,
}: {
  disabled?: boolean;
  /** The downloaded temp file — adopt it exactly like a local pick. */
  onFetched: (path: string) => Promise<void>;
  /** The link did not resolve to a readable image — the modal owns the copy. */
  onError: () => void;
}) {
  const { t } = useTranslation("library");
  const [draft, setDraft] = useState("");
  const [isFetching, setIsFetching] = useState(false);

  const fetchFromUrl = async () => {
    const url = draft.trim();
    if (!url || isFetching) return;
    setIsFetching(true);
    try {
      const fetched = await fetchImageUrl(url);
      await onFetched(fetched.path);
      setDraft("");
    } catch {
      onError();
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void fetchFromUrl();
      }}
      className="flex items-center gap-2"
    >
      <Link2 className="size-4 shrink-0 text-muted" />
      <input
        type="url"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t("imageUrl.placeholder")}
        disabled={disabled || isFetching}
        className="min-w-0 flex-1 rounded-xl border border-separator bg-transparent px-3 py-1.5 text-[0.8125rem] outline-none placeholder:text-muted/70 focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/30"
      />
      <button
        type="submit"
        disabled={draft.trim() === "" || disabled || isFetching}
        className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-default/60 px-3.5 py-1.5 text-[0.8125rem] font-medium text-foreground outline-none transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
      >
        {isFetching && <Spinner size="sm" />}
        {t("imageUrl.fetch")}
      </button>
    </form>
  );
}
