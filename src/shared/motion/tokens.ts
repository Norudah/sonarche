/**
 * Sonarche motion tokens — single source of truth for how the app moves.
 *
 * Same contract as the color/spacing tokens in app/theme.css: a component never
 * writes a duration, a stiffness or an easing curve inline. It picks the token
 * whose *intent* matches what it animates, so the whole app shares one feel.
 *
 * Rules:
 * - Springs for anything the user causes (a click, a state landing). They read
 *   as physical; a fixed duration reads as mechanical.
 * - Durations + easing only for opacity/color cross-fades, where there is no
 *   distance to travel and a spring would just be an awkward linear fade.
 * - Nothing decorative gets a token. If it does not change state or position,
 *   it does not animate.
 */

import type { Transition } from "motion/react";

/** Physics for state and position changes. Pick by intent, not by number. */
export const springs = {
  /** UI reacting to input: the sidebar pill sliding, a control pressing in.
   * Fast, no overshoot to speak of — it should feel immediate, not springy. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },

  /** Size and layout settling: a row collapsing, a section expanding. Slower
   * and fully damped, because overshooting a height looks like a glitch. */
  soft: { type: "spring", stiffness: 260, damping: 32, mass: 1 },

  /** A milestone landing: a pipeline step turning green, a copy confirming.
   * The only token allowed to overshoot — that pop is the whole point. */
  bouncy: { type: "spring", stiffness: 480, damping: 16, mass: 0.6 },
} satisfies Record<string, Transition>;

/** Seconds, for cross-fades. Kept short: this is an app, not a slideshow. */
export const durations = {
  /** Hover/press color shifts, icon swaps. Barely perceptible on purpose. */
  instant: 0.12,
  /** Element entering or leaving, page transitions. */
  fast: 0.18,
  /** Content swapping under a stable frame (now-playing track change). */
  medium: 0.28,
  /** The launch splash handing the window to the app. Longer than every other
   * cross-fade and deliberately so: this one is not a transition *within* the
   * app but the app arriving, it happens once per session, and at `medium` the
   * splash reads as having been snatched away rather than set down. */
  handover: 0.45,
  /** A value drawing itself in on arrival — the album completeness ring filling
   * from empty, and the figure counting up with it. The one token allowed to
   * run long: it is not a transition between two states but the reading of a
   * measurement, and at 0.28s the sweep is over before the eye finds it. */
  reveal: 0.9,
} as const;

/** HeroUI ships an Apple-style out curve; we reuse it rather than invent one.
 * Mirrors --ease-out-fluid from @heroui/styles. */
export const easings = {
  out: [0.16, 1, 0.3, 1],
} as const;

export const fade = {
  duration: durations.fast,
  ease: easings.out,
} satisfies Transition;

/**
 * Overshoot-and-settle on a value that ends where it started — a badge lighting
 * up, a button becoming available.
 *
 * This is a tween, not a spring, and it has to be: Motion can only ride a spring
 * between two values. Hand it a three-stop keyframe array (`[1, 1.12, 1]`) with
 * `type: "spring"` and it has no way to interpolate the middle stop, so the
 * animation silently does nothing. That is a real trap — the code looks correct
 * and simply never plays — hence this token instead of a spring at each site.
 */
export const pop = {
  duration: 0.42,
  // Peak early, settle slow: the rise is the signal, the fall is the follow-through.
  times: [0, 0.35, 1],
  ease: easings.out,
} satisfies Transition;

/** Shared `layoutId` names. Two elements claiming the same id in different
 * places is how Motion knows to tween between them, so the ids have to be
 * unique app-wide — that makes them tokens too. */
export const layoutIds = {
  /** The active-route pill travelling between sidebar nav items. */
  navIndicator: "sonarche-nav-indicator",
  /** The active-category pill inside the sidebar's settings mode. Its own id so
   * it never tries to tween across the mode swap from the main-nav pill. */
  settingsNavIndicator: "sonarche-settings-nav-indicator",
  /** The album/track pill in the composer's segmented control. */
  kindChoice: "sonarche-kind-choice",
  /** The overview/tracks pill in a scoped page's view switcher. Its own id
   * because the two switches can be on screen in the same app but never in the
   * same place — sharing one would tween a pill across half the window. */
  viewMode: "sonarche-view-mode",
  /** The ring travelling between the light/dark/system tiles in Appearance. */
  themeChoice: "sonarche-theme-choice",
  /** The Français/English pill in the same section. Its own id: the two
   * controls sit one under the other, and sharing one would fly the marker
   * across the card every time either is touched. */
  languageChoice: "sonarche-language-choice",
  /** The follow/manual pill in the lyrics panel's footer. */
  lyricsFollow: "sonarche-lyrics-follow",
  /** The album/collection pill in the inspect panel's identity column. */
  recordKind: "sonarche-record-kind",
  /** The grouping pill under the import page's folder picker. */
  grouping: "sonarche-grouping",
  /** The auto/existing/new pill in the composer's destination control. Its own
   * id: it lives one line under the kind pill, which must not tween into it. */
  destinationChoice: "sonarche-destination-choice",
} as const;
