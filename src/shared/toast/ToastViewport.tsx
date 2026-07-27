import { Toast } from "@heroui/react";

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
  return <Toast.Provider placement="bottom end" className="toast-region-lifted" width={380} />;
}
