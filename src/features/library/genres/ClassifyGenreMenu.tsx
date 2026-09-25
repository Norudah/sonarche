import { Dropdown } from "@heroui/react";
import { Check, FolderInput, Undo2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { FAMILY_KEYS } from "@/features/library/genres/genres";
import { toneOf } from "@/features/library/genres/tone";
import { HERO_BUTTON_SECONDARY } from "@/features/library/heroButton";

interface ClassifyGenreMenuProps {
  /** The current page's family, marked in the list. */
  currentKey: string;
  /** The user's placement, if any. */
  override: string | null;
  onClassify: (family: string | null) => void;
  isPending: boolean;
}

/** Files a genre under one of the families (each in its tone, the current one
 * marked). "Original placement" appears once there's an override to undo. */
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
