import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useLocation, useSearchParams } from "react-router";

import { INSPECT_PARAM, INSPECT_VALUE } from "@/app/paths";
import { isInspectable } from "@/features/library/inspect/surfaces";

/**
 * The lens: whether the library is being *read* or *inspected*.
 *
 * One switch for the whole app rather than one per table. Reading is the
 * default and says nothing about metadata — no score, no ratio, no permanent
 * mark on music somebody came to listen to. Inspection is where the holes are
 * lit, and it is entered on purpose, which is what makes an amber cell
 * information instead of a reproach.
 *
 * The mode lives in React state and not in the URL, even though it arrives
 * through one. A lens is a way of looking, not a place: it has to survive
 * opening an album and coming back, and every `Link` in the app would have had
 * to carry the param for that to work. So the param is an *entrance* — the
 * Metadata page's doors use it to hand you the lens already on — and it is
 * consumed on arrival rather than left in the address, where a stale value
 * would fight the switch.
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

  // Adopted during render rather than in an effect: the arriving page must draw
  // its first frame already inspecting, and an effect would paint the reading
  // table once and swap it — a flash on exactly the navigation this exists to
  // make seamless. Guarded against itself, so it settles in one extra render.
  if (requested && !inspecting) setInspecting(true);

  // The address bar is the external system, and clearing it is all this effect
  // does. Stripping is what keeps the two from disagreeing: consumed once, the
  // URL stops being a second source of truth, and turning the lens off cannot be
  // undone by a value left behind. `replace` because the entrance and the page
  // it opens are one navigation.
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

/** Whether this page is one the lens can change — what decides if the switch is
 * in the topbar at all. */
export function useLensAvailable(): boolean {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  return isInspectable(pathname, params);
}

/**
 * Whether the list being drawn right now is under the lens.
 *
 * The same predicate as the switch's own visibility, and that is the point: a
 * table must never redraw itself somewhere the control that did it is off
 * screen. An artist's discography is the case that forced this — the page shows
 * cards, so it gets no switch, but the guest spots underneath go through the
 * very same table and would have come out inspected with nothing to say why.
 */
export function useLensHere(): boolean {
  const { inspecting } = useInspectMode();
  return useLensAvailable() && inspecting;
}
