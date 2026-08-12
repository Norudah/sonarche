/**
 * The shape every control in the topbar wears: a square icon button, no label.
 *
 * The bar is chrome, not a toolbar of widgets — whatever sits in it has to read
 * as part of the window rather than as something dropped on top of it. One
 * shared shape is what keeps two controls from two different features (the lens,
 * settings) from arriving at two sizes and two radii, which is exactly how a
 * thin bar starts feeling crowded.
 *
 * In `shared` and not in `app/layout`: the lens toggle belongs to the library
 * feature, and a feature may not import app-level code.
 */
const BASE =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

/** Idle · a control that is doing something · the lens, which has its own
 * colour wherever it appears. */
const TONES = {
  idle: "text-muted hover:bg-default/60 hover:text-foreground",
  accent: "bg-accent/15 text-accent",
  warning: "bg-warning-soft text-warning",
} as const;

export type ChromeTone = keyof typeof TONES;

export function chromeButton(tone: ChromeTone = "idle"): string {
  return `${BASE} ${TONES[tone]}`;
}

/**
 * The same object with a word in it, for the one control in the bar that is a
 * *mode* rather than a door.
 *
 * Settings and the guide open something and give the window back; the lens
 * changes what every page below is showing until it is thrown again. An icon
 * alone could not say which of the two it was, and three identical squares in
 * a row said the opposite — that all three were the same kind of thing. The
 * hairline and the label are what set it apart while keeping the bar's height,
 * radius and hover behaviour.
 */
const PILL =
  "flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-[0.75rem] font-medium " +
  "outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

const PILL_TONES = {
  idle: "border-separator text-muted hover:bg-default/60 hover:text-foreground",
  accent: "border-transparent bg-accent/15 text-accent",
  warning: "border-warning/25 bg-warning-soft text-warning",
} as const satisfies Record<ChromeTone, string>;

export function chromePill(tone: ChromeTone = "idle"): string {
  return `${PILL} ${PILL_TONES[tone]}`;
}
