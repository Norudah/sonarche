import { Play, Shuffle } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { springs } from "@/shared/motion/tokens";
import { ActionHelp } from "@/shared/ui/FieldHelp";

/**
 * The primary actions of a page that plays a set: start at the top, or shuffle.
 *
 * Four shapes have been tried here and the first three failed the same way —
 * they all treated the two modes as siblings. Twin labelled pills said they were
 * equal and ran some 180px wide. A filled disc beside a hollow one read as a
 * button next to its own ghost, one of which looks switched off. Fusing them
 * into one accent capsule split by a hairline dropped the labels entirely: a
 * purple blob carrying two icons of identical weight, with the fold reading as a
 * split-button that opens a menu — an affordance that was not there.
 *
 * What is actually true is that there is one press, and shuffle is a variant of
 * it. So there is one object that says what it does in words, and one small
 * satellite for the variant. The satellite is `accent-soft` rather than
 * outlined: same colour family as the press, a fraction of its weight, and a
 * disc against a wide pill so the two can never be mistaken for a pair.
 *
 * Its hairline is not decoration. `accent-soft` is the accent at 12 % alpha,
 * which lands a long way above the page on paper and barely above it on Night —
 * and on Night the hero band it sits on is *itself* accent-tinted, so the fill
 * all but vanished into the wash. A chromatic edge holds in both, because it is
 * hue against a neutral rather than value against a value.
 *
 * Both sit at `h-10`, the height of every other button in the app — the capsule
 * was `h-12` and stood a row apart from the management buttons beside it.
 *
 * The satellite keeps `ActionHelp`, because *what* it plays is exactly what an
 * icon cannot say. The primary no longer needs one: it carries its own name.
 */
export function HeroPlayButtons({ onPlay, onShuffle }: { onPlay: () => void; onShuffle: () => void }) {
  const { t } = useTranslation("library");

  return (
    <div className="flex items-center gap-2">
      <motion.button
        type="button"
        onClick={onPlay}
        whileTap={{ scale: 0.97 }}
        whileHover={{ scale: 1.02 }}
        transition={springs.snappy}
        className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-accent pr-5 pl-4.5 text-sm font-medium text-accent-foreground outline-none glow-accent focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {/* A centred triangle reads as sitting left of centre — its mass is all
            on one side. One pixel over puts it back on the axis. */}
        <Play className="size-4 translate-x-px fill-current" />
        {t("playAll")}
      </motion.button>

      <ActionHelp text={t("playShuffled")}>
        <motion.button
          type="button"
          onClick={onShuffle}
          aria-label={t("playShuffled")}
          whileTap={{ scale: 0.94 }}
          whileHover={{ scale: 1.06 }}
          transition={springs.snappy}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent/25 ring-inset outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <Shuffle className="size-[1.125rem]" />
        </motion.button>
      </ActionHelp>
    </div>
  );
}
