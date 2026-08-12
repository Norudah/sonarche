import { Toast, toast } from "@heroui/react";
import { useEffect } from "react";

/**
 * Where the app's transient messages appear.
 *
 * One viewport, mounted once in the shell; anything anywhere can then call
 * HeroUI's imperative `toast()` without a provider of its own. There is
 * deliberately no wrapper around that call — a re-export that added nothing but
 * a name would only put a layer between a component and the API it is already
 * using correctly.
 *
 * Bottom right, above the player bar rather than over it: a toast is almost
 * always the consequence of an action taken elsewhere on the page, and the one
 * strip of the window that must never be covered is the one holding the
 * transport controls. `toast-region-lifted` does the lifting (theme.css) — the
 * placement variant hard-codes `bottom-4`, which lands squarely on the bar.
 */
export function ToastViewport() {
  useStartedCountdowns();
  return <Toast.Provider placement="bottom end" className="toast-region-lifted" width={340} />;
}

/**
 * Starts the dismissal countdown a toast is created with.
 *
 * react-aria builds each toast's timer but never starts it: the only calls to
 * `resumeAll` live in the region's hover and focus handlers (`useToastRegion`),
 * so a countdown begins the first time the pointer enters the region *and
 * leaves it again*. A toast nobody hovers therefore sits on screen forever and
 * has to be dismissed by hand — which is what every toast in this app did.
 *
 * Resuming on each queue change is the smallest fix that keeps the library's
 * own behaviour: the timers, their per-toast durations and the pause-on-hover
 * are all still react-aria's. Toasts created with `timeout: 0` (the update
 * installer's progress line) carry no timer and are skipped by `resumeAll`.
 */
function useStartedCountdowns() {
  useEffect(() => {
    const queue = toast.getQueue();
    return queue.subscribe(() => {
      // Hovering pauses the countdowns on purpose — someone reading a toast
      // must not have it pulled away. A second toast arriving mid-read would
      // otherwise resume the one under the cursor.
      const region = document.querySelector(".toast-region");
      if (region?.matches(":hover") || (region && region.contains(document.activeElement))) return;
      queue.resumeAll();
    });
  }, []);
}
