import { Dropdown } from "@heroui/react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SortSelectProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** The caller owns the wording: "Artist" sorts albums but "Name" sorts
   * artists, and a shared control has no business guessing which. */
  labelOf: (option: T) => string;
}

/**
 * Dropdown rather than Select: HeroUI's Select owns its trigger's field styling
 * (the same component-layer rules that made us hand-roll `SearchField`), while
 * Dropdown.Trigger is a bare react-aria Button we can shape into the same pill
 * as the search field. We keep the accessible listbox and drop the field chrome.
 */
export function SortSelect<T extends string>({ options, value, onChange, labelOf }: SortSelectProps<T>) {
  const { t } = useTranslation("library");

  return (
    <Dropdown>
      <Dropdown.Trigger className="flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-surface-secondary px-3.5 text-[0.8125rem] text-foreground outline-none transition-colors hover:bg-surface-tertiary data-[pressed]:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-accent/30">
        <span className="text-muted">{t("sort.label")}</span>
        {labelOf(value)}
        <ChevronDown className="size-3.5 text-muted" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end">
        <Dropdown.Menu
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[value]}
          onSelectionChange={(keys) => {
            const [next] = Array.from(keys as Set<string>);
            if (next) onChange(next as T);
          }}
        >
          {options.map((option) => (
            <Dropdown.Item key={option} id={option} textValue={labelOf(option)}>
              {/* Checked off our own state rather than `Dropdown.ItemIndicator`,
               * which renders unconditionally here — every option came out
               * ticked. The slot keeps its width either way so the labels do
               * not shift when the selection moves. */}
              <span className="flex w-4 shrink-0 justify-center">
                {option === value && <Check className="size-3.5" />}
              </span>
              {labelOf(option)}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
