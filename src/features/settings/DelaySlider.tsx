import { Alert, Slider } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { formatDuration, marksFor, type RateLimitDef } from "@/features/settings/rateLimits";

interface DelaySliderProps {
  def: RateLimitDef;
  seconds: number;
  onCommit: (seconds: number) => void;
}

/** One politeness delay: label, live value, slider, batch estimate, warning.
 * Auto-saves on release — Settings has no footer for this category. */
export function DelaySlider({ def, seconds, onCommit }: DelaySliderProps) {
  const { t } = useTranslation("settings");
  const [value, setValue] = useState(seconds);
  const base = `rateLimits.delays.${def.key}`;

  const marks = marksFor(def);
  const isPolite = value >= def.politeThreshold;
  const decimals = Number.isInteger(def.step) ? 0 : 2;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">{t(`${base}.name`)}</h3>
        <span className="text-sm font-medium tabular-nums text-accent">
          {value === 0 ? t("rateLimits.instant") : `${value.toFixed(decimals)}s`}
        </span>
      </div>
      <p className="text-sm text-muted">{t(`${base}.why`)}</p>

      <Slider
        aria-label={t(`${base}.name`)}
        value={value}
        minValue={def.min}
        maxValue={def.max}
        step={def.step}
        onChange={(v) => setValue(v as number)}
        onChangeEnd={(v) => onCommit(v as number)}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
      <div className="flex justify-between text-xs tabular-nums text-muted">
        {marks.map((mark) => (
          <span key={mark}>{mark === 0 ? t("rateLimits.instant") : mark}</span>
        ))}
      </div>

      <p className="text-sm text-muted">
        {t(`${base}.estimate`, {
          count: def.sampleCount,
          duration: formatDuration(value * def.sampleCount),
        })}
      </p>

      {!isPolite && (
        <Alert status="warning">
          <Alert.Content>
            <Alert.Description>{t(`${base}.warning`)}</Alert.Description>
          </Alert.Content>
        </Alert>
      )}
    </div>
  );
}
