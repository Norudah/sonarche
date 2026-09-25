import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  /**
   * Pinned to the top of the scrollport, outside the page padding. Its wrapper
   * has zero height (`h-0`) so a bar appearing on scroll can't push content
   * and oscillate.
   */
  sticky?: ReactNode;
}

/** Owns the page padding (see AppLayout). The heroes' `-mt-5` bleed must
 * match the top padding. */
export function PageContainer({ children, sticky }: PageContainerProps) {
  return (
    <>
      {sticky && <div className="sticky top-0 z-20 h-0">{sticky}</div>}
      <div className="relative flex flex-col gap-6 px-8 pt-5 pb-8">{children}</div>
    </>
  );
}
