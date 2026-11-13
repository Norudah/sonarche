import { Button } from "@heroui/react";
import { ChevronLeft, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface SetupActionBarProps {
  /** `null` on the first screen. Goes back without undoing anything. */
  onBack: (() => void) | null;
  /** A quiet text action (`ActionButton`), right beside the primary button. */
  secondary?: ReactNode;
  /** A `SetupPrimaryButton`. */
  primary: ReactNode;
}

/** Pinned under the scrolling body, so the primary button sits on the same
 * pixel on every screen and in every state. */
export function SetupActionBar({ onBack, secondary, primary }: SetupActionBarProps) {
  const { t } = useTranslation("onboarding");

  return (
    <div className="mt-3 flex min-h-10 shrink-0 items-center gap-3.5 pt-4">
      {onBack && (
        <Button
          variant="secondary"
          onPress={onBack}
          className="h-10 rounded-xl bg-surface pr-4 pl-3 shadow-xs hover:bg-panel"
        >
          <ChevronLeft className="size-4" />
          {t("nav.back")}
        </Button>
      )}
      <div className="ml-auto flex items-center gap-3.5">
        {secondary}
        {primary}
      </div>
    </div>
  );
}

interface SetupPrimaryButtonProps {
  onPress?: () => void;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  /** Work in flight: stays in place, disabled, with a spinner. */
  isPending?: boolean;
  isDisabled?: boolean;
  /** Submits the form with this id, so Enter in its field does the same. */
  form?: string;
  children: ReactNode;
}

export function SetupPrimaryButton({
  onPress,
  icon: Icon,
  trailingIcon: TrailingIcon,
  isPending = false,
  isDisabled = false,
  form,
  children,
}: SetupPrimaryButtonProps) {
  return (
    <Button
      variant="primary"
      type={form ? "submit" : "button"}
      form={form}
      onPress={onPress}
      isDisabled={isPending || isDisabled}
      className="h-10 min-w-[184px] px-5 glow-accent disabled:shadow-none"
    >
      {isPending ? <Loader2 className="size-4 animate-spin" /> : Icon && <Icon className="size-4" />}
      {children}
      {TrailingIcon && !isPending && <TrailingIcon className="size-4" />}
    </Button>
  );
}
