import { Slider } from "@heroui/react";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

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

/**
 * The printed scale. Positioned from the stops rather than spread evenly,
 * because the track is linear in stops and not in seconds — see `rateLimits.ts`.
 * The two ends are aligned to their edge instead of centred on it, the way a
 * ruler prints its first and last number.
 */
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

/**
 * One politeness delay: what it is, why it exists, the dial, what a batch will
 * cost at that setting, and — under one second — a word about why that is a bad
 * idea. Auto-saves on release; this category has no footer.
 *
 * The slider runs on stop *indexes*, not on seconds: the scale is deliberately
 * uneven, so the only value that can travel evenly along the rail is the
 * position in the list.
 */
export function DelaySlider({ def, seconds, onCommit }: DelaySliderProps) {
  const { t, i18n } = useTranslation("settings");
  const stops = stopsFor(def.max);
  const [index, setIndex] = useState(() => nearestStopIndex(stops, seconds));
  const base = `rateLimits.delays.${def.key}`;

  const value = stops[index];
  const instantLabel = t("rateLimits.instant");
  const locale = i18n.resolvedLanguage ?? "fr";
  const isPolite = value >= def.politeThreshold;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-medium">{t(`${base}.name`)}</h3>
        <span className={`text-sm font-medium tabular-nums ${isPolite ? "text-accent" : "text-warning"}`}>
          {formatDelay(value, locale, instantLabel)}
        </span>
      </div>
      <p className="text-sm text-muted">{t(`${base}.why`)}</p>

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

      <p className="text-sm text-muted">
        {t(`${base}.estimate`, {
          count: def.sampleCount,
          duration: formatDuration(value * def.sampleCount),
        })}
      </p>

      {!isPolite && (
        <div className="flex items-start gap-2.5 rounded-xl border border-warning/25 bg-warning/8 p-3 text-[0.8125rem] leading-relaxed text-foreground">
          <TriangleAlert className="mt-px size-4 shrink-0 text-warning" />
          <p>
            <span className="font-medium">{t("rateLimits.impoliteTitle")}</span> {t(`${base}.warning`)}
          </p>
        </div>
      )}
    </div>
  );
}
