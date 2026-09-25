import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { INSPECT_PARAM, INSPECT_VALUE } from "@/app/paths";
import { isInspectable } from "@/features/library/inspect/surfaces";

/**
 * The lens: reading or inspecting, app-wide. Held in React state so it
 * survives navigation; `?vue=inspection` is only an entrance, consumed on
 * arrival.
 */

interface InspectMode {
  inspecting: boolean;
  setInspecting: (value: boolean) => void;
}

const InspectModeContext = createContext<InspectMode | null>(null);

export function InspectModeProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get(INSPECT_PARAM) === INSPECT_VALUE;
  const [inspecting, setInspecting] = useState(requested);

  // Adopted during render so the page's first frame is already inspecting.
  if (requested && !inspecting) setInspecting(true);

  // Strip the consumed param (`replace`) so the URL isn't a second source of truth.
  useEffect(() => {
    if (!requested) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete(INSPECT_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [requested, setParams]);

  const value = useMemo(() => ({ inspecting, setInspecting }), [inspecting]);

  return <InspectModeContext.Provider value={value}>{children}</InspectModeContext.Provider>;
}

export function useInspectMode(): InspectMode {
  const mode = useContext(InspectModeContext);
  if (mode == null) throw new Error("useInspectMode must be used inside an InspectModeProvider");
  return mode;
}

/** Whether the topbar shows the switch on this page. */
export function useLensAvailable(): boolean {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  return isInspectable(pathname, params);
}

/** Whether the current list is under the lens: same predicate as the switch's
 * visibility, so a table never changes where the switch is hidden. */
export function useLensHere(): boolean {
  const { inspecting } = useInspectMode();
  return useLensAvailable() && inspecting;
}
