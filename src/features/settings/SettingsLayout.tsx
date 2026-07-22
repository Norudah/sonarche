import { Outlet } from "react-router";

import { PageContainer } from "@/shared/ui/PageContainer";

/** Settings is a shell destination now: the sidebar is the category menu and
 * this is only the content column. Each category owns its own hero and state,
 * so the layout is just the page frame around whichever one is routed. */
export function SettingsLayout() {
  return (
    <PageContainer>
      {/* A bounded reading column, not the full page width: a settings control
          (a slider, a key field) has a natural size, so a card stretched edge to
          edge would just be half-empty. `max-w-2xl` keeps the cards filled and
          the measure comfortable; the space to their right is deliberate, the
          way system-settings panes leave it. */}
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <Outlet />
      </div>
    </PageContainer>
  );
}
