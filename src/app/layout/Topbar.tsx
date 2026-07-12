import { Button } from "@heroui/react";
import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * Thin window chrome. The whole strip is the macOS drag region (data-tauri-drag-region);
 * the left inset clears the native traffic lights (titleBarStyle: Overlay). Holds only a
 * settings entry point for now — the panel itself comes later.
 */
export function Topbar() {
  const { t } = useTranslation("common");

  return (
    <header
      data-tauri-drag-region
      className="flex h-topbar shrink-0 items-center justify-end border-b border-separator pr-2 pl-20"
    >
      <Button variant="ghost" size="sm" isIconOnly aria-label={t("settings")}>
        <Settings className="size-4" />
      </Button>
    </header>
  );
}
