import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";

import { useSaveAcoustidKey } from "@/features/onboarding/hooks";
import { keyView } from "@/features/onboarding/keyView";

const ACCOUNT_URL = "https://acoustid.org/login";
const APPLICATION_URL = "https://acoustid.org/new-application";

/** The two pages to visit before the key can be pasted. */
const KEY_LINKS = [ACCOUNT_URL, APPLICATION_URL] as const;

/** The AcoustID key screen's state, held above the screens like the engine's.
 * Session only: nothing but the key itself is stored. */
export function useKeyFlow(configured: boolean) {
  const save = useSaveAcoustidKey();
  const [page, setPage] = useState<"intro" | "steps">("intro");
  const [changing, setChanging] = useState(false);
  /** Link steps behind the user (0–2); the field opens at 2. */
  const [visited, setVisited] = useState(0);
  const [value, setValue] = useState("");

  const rejection = save.data && !save.data.valid ? save.data.reason : null;
  const view = keyView({
    page,
    configured,
    changing,
    saving: save.isPending,
    rejected: rejection !== null,
    justSaved: save.data?.valid === true,
  });

  return {
    view,
    configured,
    visited,
    value,
    rejection,
    unreachable: save.isError,

    start: () => setPage("steps"),
    /** "I already have a key": straight to the field. */
    skipToField: () => {
      setPage("steps");
      setVisited(KEY_LINKS.length);
    },
    openLink: (index: number) => {
      void openUrl(KEY_LINKS[index]);
      setVisited((done) => Math.max(done, index + 1));
    },
    change: () => {
      setChanging(true);
      setPage("steps");
      setVisited(KEY_LINKS.length);
      setValue("");
      save.reset();
    },
    edit: (next: string) => {
      setValue(next);
      // A verdict belongs to the key it judged.
      if (save.data || save.isError) save.reset();
    },
    submit: () => {
      const key = value.trim();
      if (key && !save.isPending) save.mutate(key);
    },
  };
}

export type KeyFlow = ReturnType<typeof useKeyFlow>;
