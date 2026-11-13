import { cn } from "@heroui/react";
import { motion } from "motion/react";

import { fade, springs } from "@/shared/motion/tokens";

interface SetupHeaderProps {
  eyebrow: string;
  title: string;
  lead: string;
  /** The eyebrow turns red on a failure. */
  tone?: "accent" | "danger";
}

export function SetupHeader({ eyebrow, title, lead, tone = "accent" }: SetupHeaderProps) {
  return (
    // Keyed by its title: each new state rises in once.
    <motion.header
      key={title}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.soft, opacity: fade }}
      className="flex flex-col"
    >
      <p
        className={cn(
          "text-[0.6875rem] font-semibold tracking-[0.06em] uppercase",
          tone === "danger" ? "text-danger" : "text-accent",
        )}
      >
        {eyebrow}
      </p>
      <h1 className="mt-1.5 text-3xl leading-[1.15] font-semibold tracking-tight text-balance">{title}</h1>
      <p className="mt-2.5 max-w-[440px] text-[0.9375rem] leading-relaxed text-pretty text-muted">{lead}</p>
    </motion.header>
  );
}
