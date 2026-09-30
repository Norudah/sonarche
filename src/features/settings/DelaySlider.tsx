import { Slider } from "@heroui/react";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { SettingCardHeader } from "@/features/settings/SettingCard";
import {
  formatDelay,
  formatDuration,
  marksFor,
  nearestStopIndex,
  stopsFor,
  type RateLimitDef,
} from "@/features/settings/rateLimits";

interface DelaySliderProps {
  def: RateLimitDef;
  seconds: number;
  onCommit: (seconds: number) => void;
}

/** Labels positioned by stop index (the scale is uneven, see `rateLimits.ts`);
 * the ends align to the edges. */
function Scale({ max, instantLabel, locale }: { max: number; instantLabel: string; locale: string }) {
  const marks = marksFor(max);

  return (
    <div className="relative mt-1.5 h-4 text-[0.6875rem] tabular-nums text-muted">
      {marks.map((mark, index) => (
        <span
          key={mark.value}
          className="absolute whitespace-nowrap"
          style={{
            left: `${mark.position}%`,
            transform: index === 0 ? "none" : index === marks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
          }}
        >
          {formatDelay(mark.value, locale, instantLabel)}
        </span>
      ))}
    </div>
  );
}

/** One delay with its cost estimate and a warning under one second. Saves on
 * release. The slider moves over stop indexes, not seconds. */
export function DelaySlider({ def, seconds, onCommit }: DelaySliderProps) {
  const { t, i18n } = useTranslation("settings");
  const stops = stopsFor(def.max);
  const [index, setIndex] = useState(() => nearestStopIndex(stops, seconds));
  const base = def.labelBase;

  const value = stops[index];
  const instantLabel = t("instant");
  const locale = i18n.resolvedLanguage ?? "fr";
  const isPolite = value >= def.politeThreshold;

  return (
    <div className="flex flex-col gap-3">
      <SettingCardHeader
        title={t(`${base}.name`)}
        description={t(`${base}.why`)}
        trailing={
          <span className={`text-[0.8125rem] font-semibold tabular-nums ${isPolite ? "text-accent" : "text-warning"}`}>
            {formatDelay(value, locale, instantLabel)}
          </span>
        }
      />

      <div>
        <Slider
          className="settings-slider"
          aria-label={t(`${base}.name`)}
          value={index}
          minValue={0}
          maxValue={stops.length - 1}
          step={1}
          onChange={(next) => setIndex(next as number)}
          onChangeEnd={(next) => onCommit(stops[next as number])}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <Scale max={def.max} instantLabel={instantLabel} locale={locale} />
      </div>

      <p className="text-[0.8125rem] leading-relaxed text-muted">
        {t(`${base}.estimate`, {
          count: def.sampleCount,
          duration: formatDuration(value * def.sampleCount),
        })}
      </p>

      {!isPolite && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/8 p-3 text-[0.8125rem] leading-relaxed text-foreground">
          <TriangleAlert className="mt-px size-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">{t("adding.impoliteTitle")}</span> {t(`${base}.warning`)}
          </p>
        </div>
      )}
    </div>
  );
}
