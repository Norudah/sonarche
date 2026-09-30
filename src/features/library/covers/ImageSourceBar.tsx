import { Spinner } from "@heroui/react";
import { ClipboardPaste, FolderOpen, Link2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchImageUrl } from "@/features/library/api";
import { PASTE_CHORD, readClipboardContent, usePasteShortcut } from "@/features/library/covers/clipboard";

/** Every way a new image arrives: browse, a link, the clipboard (⌘V
 * anywhere). Dropping works on the stage above. */
export function ImageSourceBar({
  active,
  disabled = false,
  onBrowse,
  onAdopt,
  onNotice,
}: {
  /** Gates the ⌘V shortcut. */
  active: boolean;
  disabled?: boolean;
  /** The modal owns the picker. */
  onBrowse: () => void;
  /** A fetched link or saved paste, adopted like a local pick. */
  onAdopt: (path: string) => Promise<void>;
  /** The modal owns the message line. */
  onNotice: (message: string) => void;
}) {
  const { t } = useTranslation("library");
  const [linkOpen, setLinkOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const busy = disabled || isFetching || isReadingClipboard;

  useEffect(() => {
    if (linkOpen) linkInputRef.current?.focus();
  }, [linkOpen]);

  // Reset during render when the modal closes.
  const [wasActive, setWasActive] = useState(active);
  if (wasActive !== active) {
    setWasActive(active);
    if (!active) {
      setLinkOpen(false);
      setDraft("");
    }
  }

  const fetchLink = async (url: string) => {
    setIsFetching(true);
    try {
      const fetched = await fetchImageUrl(url);
      await onAdopt(fetched.path);
      setDraft("");
      setLinkOpen(false);
    } catch {
      onNotice(t("imageUrl.failed"));
    } finally {
      setIsFetching(false);
    }
  };

  const adoptClipboard = async () => {
    if (busy) return;
    setIsReadingClipboard(true);
    try {
      const content = await readClipboardContent();
      if (content.kind === "image") await onAdopt(content.path);
      else if (content.kind === "url") await fetchLink(content.url);
      else if (content.kind === "oversized") onNotice(t("imageSource.clipboardTooLarge"));
      else onNotice(t("imageSource.clipboardEmpty"));
    } catch {
      onNotice(t("imageSource.clipboardUnreadable"));
    } finally {
      setIsReadingClipboard(false);
    }
  };

  usePasteShortcut(active && !busy, () => void adoptClipboard());

  const chip =
    "flex cursor-pointer items-center gap-2 rounded-full border border-separator px-3.5 py-1.5 text-[0.8125rem] font-medium text-foreground outline-none transition-colors hover:bg-default/60 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45";

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
          {t("imageSource.heading")}
        </h3>
        <span className="text-[0.6875rem] text-muted/70">{t("imageSource.hint")}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy} onClick={onBrowse} className={chip}>
          <FolderOpen className="size-3.5" />
          {t("imageSource.browse")}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-expanded={linkOpen}
          onClick={() => setLinkOpen((open) => !open)}
          className={`${chip} ${linkOpen ? "border-accent/50 bg-default/60" : ""}`}
        >
          <Link2 className="size-3.5" />
          {t("imageSource.pasteLink")}
        </button>
        <button type="button" disabled={busy} onClick={() => void adoptClipboard()} className={chip}>
          {isReadingClipboard ? <Spinner size="sm" /> : <ClipboardPaste className="size-3.5" />}
          {t("imageSource.clipboard")}
          <kbd className="rounded-md border border-separator px-1.5 py-px font-sans text-[0.625rem] font-normal text-muted">
            {PASTE_CHORD}
          </kbd>
        </button>
      </div>
      {linkOpen && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const url = draft.trim();
            if (url && !busy) void fetchLink(url);
          }}
          className="flex items-center gap-2"
        >
          <input
            ref={linkInputRef}
            type="url"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("imageUrl.placeholder")}
            disabled={busy}
            className="min-w-0 flex-1 rounded-xl border border-separator bg-transparent px-3 py-1.5 text-[0.8125rem] outline-none placeholder:text-muted/70 focus:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/30"
          />
          <button
            type="submit"
            disabled={draft.trim() === "" || busy}
            className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full bg-default/60 px-3.5 py-1.5 text-[0.8125rem] font-medium text-foreground outline-none transition-colors hover:bg-default focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-default disabled:opacity-45"
          >
            {isFetching && <Spinner size="sm" />}
            {t("imageUrl.fetch")}
          </button>
        </form>
      )}
    </section>
  );
}
