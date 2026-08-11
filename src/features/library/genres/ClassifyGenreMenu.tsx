import { Dropdown } from "@heroui/react";
import { Check, FolderInput, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FAMILY_KEYS } from "@/features/library/genres/genres";
import { toneOf } from "@/features/library/genres/tone";
import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";

interface ClassifyGenreMenuProps {
  /** Family key of the page the menu sits on — marked as the current shelf. */
  currentKey: string;
  /** The user's own placement for this genre, when one exists. */
  override: string | null;
  onClassify: (family: string | null) => void;
  isPending: boolean;
}

/**
 * Where this genre files, as a choice rather than a verdict.
 *
 * Thirteen families and nothing else: the set is closed (see `tone.ts` for
 * why), so the menu can show every destination and colour each with the tone
 * that already identifies it across the app. The current shelf is marked, not
 * hidden — a list with a hole where "here" should be reads as a bug.
 *
 * The way back only appears once there is a placement to take back. It names
 * the base tree's verdict rather than "cancel": nothing is pending, the user
 * is choosing between their reading and the app's.
 */
export function ClassifyGenreMenu({ currentKey, override, onClassify, isPending }: ClassifyGenreMenuProps) {
  const { t } = useTranslation("library");

  return (
    <Dropdown>
      <Dropdown.Trigger className={`${HERO_BUTTON_SECONDARY} data-[pressed]:bg-surface`} isDisabled={isPending}>
        <FolderInput className="size-4 text-muted" />
        {t("genres.classify")}
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom start">
        <Dropdown.Menu
          onAction={(key) => {
            if (key === "reset") onClassify(null);
            else if (key !== currentKey) onClassify(String(key));
          }}
        >
          {FAMILY_KEYS.map((family) => (
            <Dropdown.Item key={family} id={family} textValue={family}>
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: toneOf(family) }}
              />
              {family}
              {family === currentKey && <Check className="ml-auto size-4 text-muted" />}
            </Dropdown.Item>
          ))}
          {override != null && (
            <Dropdown.Item id="reset" textValue={t("genres.classifyReset")}>
              <Undo2 className="size-4 text-muted" />
              {t("genres.classifyReset")}
            </Dropdown.Item>
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
