/**
 * Motion tokens: components pick a token by intent instead of inlining
 * durations or springs.
 * - Springs for user-caused changes.
 * - Durations + easing for opacity/color cross-fades.
 * - Nothing decorative animates.
 */

import type { Transition } from "motion/react";

export const springs = {
  /** Responding to input; barely any overshoot. */
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },

  /** Size and layout changes; fully damped. */
  soft: { type: "spring", stiffness: 260, damping: 32, mass: 1 },

  /** Milestones (a step turning green); the only one allowed to overshoot. */
  bouncy: { type: "spring", stiffness: 480, damping: 16, mass: 0.6 },
} satisfies Record<string, Transition>;

/** Seconds. */
export const durations = {
  /** Hover/press colour shifts, icon swaps. */
  instant: 0.12,
  /** Elements entering or leaving, page transitions. */
  fast: 0.18,
  /** Content swapping in a stable frame. */
  medium: 0.28,
  /** The launch splash handing over to the app, once per session. */
  handover: 0.45,
  /** A value drawing itself in (the completeness ring). */
  reveal: 0.9,
} as const;

/** HeroUI's out curve (--ease-out-fluid in @heroui/styles). */
export const easings = {
  out: [0.16, 1, 0.3, 1],
} as const;

export const fade = {
  duration: durations.fast,
  ease: easings.out,
} satisfies Transition;

/**
 * Overshoot-and-settle for a value that ends where it started. A tween, since
 * Motion can't spring through a three-stop keyframe array (it silently does
 * nothing).
 */
export const pop = {
  duration: 0.42,
  times: [0, 0.35, 1],
  ease: easings.out,
} satisfies Transition;

/** Shared `layoutId`s. Motion tweens between elements with the same id, so
 * each must be unique app-wide; controls visible together get their own. */
export const layoutIds = {
  navIndicator: "sonarche-nav-indicator",
  settingsNavIndicator: "sonarche-settings-nav-indicator",
  kindChoice: "sonarche-kind-choice",
  viewMode: "sonarche-view-mode",
  themeChoice: "sonarche-theme-choice",
  languageChoice: "sonarche-language-choice",
  lyricsFollow: "sonarche-lyrics-follow",
  recordKind: "sonarche-record-kind",
  grouping: "sonarche-grouping",
  destinationChoice: "sonarche-destination-choice",
  audioFormat: "sonarche-audio-format",
  inspectLens: "sonarche-inspect-lens",
} as const;
