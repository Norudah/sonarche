import { cn } from "@heroui/react";
import type { ReactNode } from "react";

import { WindowDragStrip } from "@/shared/ui/WindowDragStrip";

interface SetupLayoutProps {
  /** Spans the window and clips itself to the left panel (see `SetupScene`). */
  scene: ReactNode;
  topBar: ReactNode;
  /** The entrance into the app: the column steps aside for the scene. */
  leaving?: boolean;
  /** A screen: its `SetupBody`, then its `SetupActionBar`. */
  children: ReactNode;
}

/** Two columns: the ark on the left, the current step on the right. */
export function SetupLayout({ scene, topBar, leaving = false, children }: SetupLayoutProps) {
  return (
    <div className="setup-layout relative isolate h-full overflow-hidden bg-background">
      <WindowDragStrip />
      {scene}
      <main
        inert={leaving}
        className={cn(
          "absolute inset-y-0 right-0 left-[calc(var(--setup-scene-w)+24px)] flex flex-col px-12 pt-[18px] pb-[22px]",
          "transition-[opacity,translate] duration-350 ease-out motion-reduce:transition-none",
          leaving && "translate-x-4 opacity-0",
        )}
      >
        {topBar}
        {children}
      </main>
    </div>
  );
}

/** The screen's scrolling part, above the fixed action bar. Bleeds 8px on the
 * sides so card shadows aren't cut by the scroll clip. */
export function SetupBody({ children }: { children: ReactNode }) {
  return <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pt-12 pb-2">{children}</div>;
}
