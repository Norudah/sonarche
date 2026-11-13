import type { LucideIcon } from "lucide-react";

interface Fact {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** What a step involves, before it starts: three short facts. */
export function FactList({ facts }: { facts: readonly Fact[] }) {
  return (
    <ul className="mt-7 flex flex-col gap-4">
      {facts.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-center gap-3.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-col gap-px">
            <strong className="text-sm font-semibold break-words">{title}</strong>
            <span className="text-[0.8125rem] leading-snug text-muted">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
