/** Shared shape for topbar icon buttons, so controls from different
 * features match. */
const BASE =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40";

/** Idle · active · the lens colour. */
const TONES = {
  idle: "text-muted hover:bg-default/60 hover:text-foreground",
  accent: "bg-accent/15 text-accent",
  warning: "bg-warning-soft text-warning",
} as const;

export type ChromeTone = keyof typeof TONES;

export function chromeButton(tone: ChromeTone = "idle"): string {
  return `${BASE} ${TONES[tone]}`;
}
