import { useTranslation } from "react-i18next";

/** One album as a spine: a title bar and its track count. */
function Shelf({ width, count, tone }: { width: string; count: number; tone: "scattered" | "gathered" }) {
  const accent = tone === "gathered";
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 rounded-full ${accent ? "bg-accent" : "bg-muted/35"}`} style={{ width }} aria-hidden />
      <span className={`text-[0.625rem] tabular-nums ${accent ? "text-accent" : "text-muted/70"}`}>{count}</span>
    </div>
  );
}

/** Illustrates the option: several one-track albums versus one full album.
 * The counts are illustrative, not a forecast. */
export function ForcedAlbumPreview({ isOn }: { isOn: boolean }) {
  const { t } = useTranslation("download");

  return (
    // `w-fit` keeps the two stacks close enough to compare.
    <div className="flex w-fit items-stretch gap-5 rounded-xl bg-default/40 px-3.5 py-2.5">
      <figure className={`flex flex-col gap-1.5 transition-opacity ${isOn ? "opacity-45" : ""}`}>
        <figcaption className="text-[0.625rem] font-medium tracking-wide text-muted uppercase">
          {t("options.destination.without")}
        </figcaption>
        <Shelf width="2.5rem" count={1} tone="scattered" />
        <Shelf width="3.5rem" count={2} tone="scattered" />
        <Shelf width="2rem" count={1} tone="scattered" />
      </figure>

      <div className="w-px shrink-0 bg-separator" aria-hidden />

      <figure className={`flex flex-col gap-1.5 transition-opacity ${isOn ? "" : "opacity-45"}`}>
        <figcaption
          className={`text-[0.625rem] font-medium tracking-wide uppercase ${isOn ? "text-accent" : "text-muted"}`}
        >
          {t("options.destination.with")}
        </figcaption>
        <Shelf width="4.5rem" count={4} tone="gathered" />
      </figure>
    </div>
  );
}
