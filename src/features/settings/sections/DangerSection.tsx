import { Button } from "@heroui/react";
import { useTranslation } from "react-i18next";

import { AIMED_ERASES, FULL_ERASE, type EraseDef } from "@/features/settings/erases";
import { SectionHeader } from "@/features/settings/SectionHeader";
import { useSettingsTasks } from "@/features/settings/tasks";

/** One erase: what it takes away, and the button that takes it. The reason
 * stays on screen here rather than folding behind a mark the way an ordinary
 * setting's does — you do not hide what an irreversible action destroys.
 *
 * `solid` is the full erase alone. Four crimson slabs in a column read as an
 * alarm that is permanently on, which is the fastest way to stop being read at
 * all — and the wording under each name is what actually carries the warning.
 * Outlined is the register for "destructive, and you came to this pane on
 * purpose"; the one filled button is kept for the action that covers all the
 * others. */
function DangerAction({ def, solid = false }: { def: EraseDef; solid?: boolean }) {
  const { t } = useTranslation("settings");
  const { start } = useSettingsTasks();
  const { key } = def;

  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="flex flex-col gap-1">
        <p className="text-[0.8125rem] font-semibold">{t(`danger.${key}.name`)}</p>
        <p className="text-[0.8125rem] leading-relaxed text-muted">{t(`danger.${key}.why`)}</p>
      </div>
      {/* No glyph, and the width is the pane's floor rather than the label's:
          four buttons in a column that each said "Supprimer" behind a different
          icon were four different widths, which reads as four different
          actions. The icon is not lost — the confirmation dialog still shows
          the erase's own, where there is one thing to look at. */}
      <Button
        variant={solid ? "danger" : "danger-soft"}
        className="mt-0.5 shrink-0"
        onPress={() => start({ kind: "erase", key })}
      >
        {t(`danger.${key}.action`)}
      </Button>
    </div>
  );
}

/**
 * The actions that cannot be undone — a category of their own now, named for
 * what it holds.
 *
 * It used to be a red-framed block at the foot of the Library page, under the
 * music folder and the diagnostic log. Two problems with that: you had to
 * scroll past it to reach ordinary settings, and you could not *find* it when
 * you actually wanted it, because nothing in the menu said "this is where
 * things get deleted". Five irreversible actions have earned a door with their
 * name on it.
 *
 * The environment reinstall left with the move: it is drastic, not dangerous,
 * and every red row here loses something no backup will bring back. A colour
 * that also means "safe but drastic" stops meaning anything.
 *
 * The pane only asks. Confirming and running happen in `SettingsTaskHost`,
 * outside this dialog, so an erase in flight cannot be dismissed by the
 * gestures that dismiss settings.
 */
export function DangerSection() {
  const { t } = useTranslation("settings");

  return (
    <>
      <SectionHeader title={t("danger.title")} description={t("danger.description")} />

      <div className="overflow-hidden rounded-xl border border-danger/30 bg-surface">
        <div className="divide-y divide-separator px-4">
          {AIMED_ERASES.map((def) => (
            <DangerAction key={def.key} def={def} />
          ))}
        </div>

        {/* The full erase closes the card in its own tinted band: it is the one
            row that covers all the others, and the eye should have to cross a
            visible boundary to reach it. */}
        <div className="border-t border-danger/20 bg-danger/5 px-4">
          <DangerAction def={FULL_ERASE} solid />
        </div>
      </div>
    </>
  );
}
