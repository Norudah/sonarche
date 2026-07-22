import type { ReactNode } from "react";

/** One setting, boxed on the app's surface with the same rounded-xl / separator
 * border the queue table and cards wear elsewhere. Gives each control its own
 * plane to sit on instead of floating bare divs down the page. */
export function SettingCard({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-separator bg-surface p-5">{children}</div>;
}
