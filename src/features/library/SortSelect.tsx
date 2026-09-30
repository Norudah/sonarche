import { Dropdown } from "@heroui/react";
import { Check, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SortSelectProps<T extends string> {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Wording belongs to the caller ("Artist" vs "Name"). */
  labelOf: (option: T) => string;
}

/** A Dropdown rather than HeroUI's Select, whose trigger forces field styling. */
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
              {/* Our own check: `Dropdown.ItemIndicator` ticked every option. Fixed width. */}
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
