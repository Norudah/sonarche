import { cn } from "@heroui/react";
import { useTranslation } from "react-i18next";

import type { SetupMode } from "@/features/onboarding/steps";

/** On the water under the ark, once the scene fills the window. */
export function EntranceWelcome({ mode, visible }: { mode: SetupMode; visible: boolean }) {
  const { t } = useTranslation("onboarding");
  const { t: tCommon } = useTranslation("common");

  return (
    <div
      className={cn(
        // 112px under the frame's centre, where the water is calm.
        "absolute inset-x-0 top-[calc(50%+112px)] flex flex-col items-center gap-2 px-6 text-center",
        "transition-[opacity,translate] delay-100 duration-700 ease-out",
        visible ? "opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <p className="text-[0.6875rem] font-semibold tracking-[0.06em] text-accent uppercase">{tCommon("appName")}</p>
      <h2 className="text-3xl font-semibold tracking-tight">{t(`welcome.${mode}.title`)}</h2>
      <p className="text-[0.9375rem] text-muted">{t(`welcome.${mode}.text`)}</p>
    </div>
  );
}
