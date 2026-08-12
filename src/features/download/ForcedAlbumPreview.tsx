import { useTranslation } from "react-i18next";

/** One album, drawn as its shelf spine: a title bar and how many tracks sit
 * under it. Widths differ so a stack of three reads as three *different*
 * records rather than a repeated element. */
function Shelf({ width, count, tone }: { width: string; count: number; tone: "scattered" | "gathered" }) {
  const accent = tone === "gathered";
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 rounded-full ${accent ? "bg-accent" : "bg-muted/35"}`} style={{ width }} aria-hidden />
      <span className={`text-[0.625rem] tabular-nums ${accent ? "text-accent" : "text-muted/70"}`}>{count}</span>
    </div>
  );
}

/**
 * Why the option exists, in the shape of the problem it solves.
 *
 * "A playlist becomes several incomplete albums" is a fact about *structure*,
 * and structure is the one thing a sentence explains slowly and a picture
 * explains at a glance: four thin spines with one track each, against a single
 * spine with four. Deliberately the only illustration in the composer — it
 * earns its place because this is the option whose consequence nobody guesses.
 *
 * The numbers are shapes, not a forecast: the panel has no idea yet how the
 * playlist would split, and inventing a plausible tally would be a claim.
 */
export function ForcedAlbumPreview({ isOn }: { isOn: boolean }) {
  const { t } = useTranslation("download");

  return (
    // `w-fit`, not a full-width row: stretched across the composer the two
    // stacks drift apart and stop reading as a comparison.
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
