import { Toast, toast } from "@heroui/react";
import { useEffect } from "react";

/**
 * The single toast viewport; call HeroUI's `toast()` directly anywhere.
 * Bottom right, lifted above the player bar by `toast-region-lifted`
 * (theme.css), since the placement variant hard-codes `bottom-4`.
 */
export function ToastViewport() {
  useStartedCountdowns();
  return <Toast.Provider placement="bottom end" className="toast-region-lifted" width={340} />;
}

/**
 * Starts each toast's dismissal countdown. react-aria only resumes timers on
 * region hover/focus exit, so an untouched toast never went away. Toasts with
 * `timeout: 0` have no timer and are skipped.
 */
function useStartedCountdowns() {
  useEffect(() => {
    const queue = toast.getQueue();
    return queue.subscribe(() => {
      // Keep countdowns paused while the pointer is over the region.
      const region = document.querySelector(".toast-region");
      if (region?.matches(":hover") || (region && region.contains(document.activeElement))) return;
      queue.resumeAll();
    });
  }, []);
}
