import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

/**
 * The app's one text-level control: a link, or a button that reads as one.
 *
 * It exists because the same affordance had been written four times by hand and
 * had drifted — the history's "Vider l'historique" was muted text with a hover
 * underline, the feed's "Tout l'historique" was accent text with an arrow that
 * slid. This is the second reading, kept: the label states the action and the
 * icon answers the cursor, which is enough motion for a control that is not a
 * button.
 *
 * Two components rather than one polymorphic `as`: a router link and a button
 * take different props, and the union of both is a type nobody reads twice.
 */

export type ActionTone = "accent" | "muted" | "danger";

const TONE: Record<ActionTone, string> = {
  accent: "text-accent hover:text-accent/80",
  muted: "text-muted hover:text-foreground",
  danger: "text-danger hover:text-danger/80",
};

const BASE =
  "group/action inline-flex shrink-0 items-center gap-1.5 rounded-sm text-[0.8125rem] font-medium " +
  "underline-offset-4 outline-none transition-colors focus-visible:underline";

const DISABLED = "disabled:pointer-events-none disabled:opacity-40";

interface ActionContentProps {
  /** Sits before the label and lifts a hair under the cursor. */
  icon?: LucideIcon;
  /** Sits after the label and slides along the reading direction — reserved for
   * an arrow, where the movement means "over there". */
  trailingIcon?: LucideIcon;
  children: ReactNode;
}

function ActionContent({ icon: Icon, trailingIcon: TrailingIcon, children }: ActionContentProps) {
  return (
    <>
      {Icon && (
        <Icon className="size-3.5 shrink-0 transition-transform duration-200 ease-out group-hover/action:-translate-y-px motion-reduce:transition-none" />
      )}
      {children}
      {TrailingIcon && (
        <TrailingIcon className="size-3.5 shrink-0 transition-transform duration-200 ease-out group-hover/action:translate-x-0.5 motion-reduce:transition-none" />
      )}
    </>
  );
}

interface ActionLinkProps extends ActionContentProps {
  to: string;
  tone?: ActionTone;
  className?: string;
}

export function ActionLink({ to, tone = "accent", className, ...content }: ActionLinkProps) {
  return (
    <Link to={to} className={`${BASE} ${TONE[tone]} ${className ?? ""}`}>
      <ActionContent {...content} />
    </Link>
  );
}

interface ActionButtonProps extends ActionContentProps {
  onPress: () => void;
  tone?: ActionTone;
  isDisabled?: boolean;
  className?: string;
}

export function ActionButton({
  onPress,
  tone = "accent",
  isDisabled = false,
  className,
  ...content
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={isDisabled}
      className={`${BASE} ${TONE[tone]} ${DISABLED} cursor-pointer ${className ?? ""}`}
    >
      <ActionContent {...content} />
    </button>
  );
}
