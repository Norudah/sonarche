import { Alert, Slider } from "@heroui/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { Preferences } from "@/features/settings/api";

const MIN_DELAY = 0;
const MAX_DELAY = 1.5;
const STEP = 0.25;
const POLITE_THRESHOLD = 1;
// Not the user's real library size — a round reference so the estimate stays
// meaningful without reaching into the library feature from Settings.
const SAMPLE_TRACK_COUNT = 100;

const MARKS = Array.from(
  { length: Math.round((MAX_DELAY - MIN_DELAY) / STEP) + 1 },
  (_, i) => MIN_DELAY + i * STEP,
);

function formatDuration(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return seconds === 0 ? `${minutes}min` : `${minutes}min ${seconds}s`;
}

interface RateLimitsSectionProps {
  preferences: Preferences;
  onChangeDelay: (seconds: number) => void;
}

export function RateLimitsSection({ preferences, onChangeDelay }: RateLimitsSectionProps) {
  const { t } = useTranslation("settings");
  const [value, setValue] = useState(preferences.lastfmFetchDelaySeconds);

  const isPolite = value >= POLITE_THRESHOLD;
  const estimate = formatDuration(value * SAMPLE_TRACK_COUNT);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold">{t("rateLimits.title")}</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">{t("rateLimits.description")}</p>
      </div>

      <div className="flex max-w-lg flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">{t("rateLimits.lastfmDelay.name")}</h3>
          <span className="text-sm font-medium tabular-nums text-accent">
            {value === 0 ? t("rateLimits.lastfmDelay.instant") : `${value.toFixed(2)}s`}
          </span>
        </div>
        <p className="text-sm text-muted">{t("rateLimits.lastfmDelay.why")}</p>

        <Slider
          aria-label={t("rateLimits.lastfmDelay.name")}
          value={value}
          minValue={MIN_DELAY}
          maxValue={MAX_DELAY}
          step={STEP}
          onChange={(v) => setValue(v as number)}
          onChangeEnd={(v) => onChangeDelay(v as number)}
        >
          <Slider.Track>
            <Slider.Fill />
            <Slider.Thumb />
          </Slider.Track>
        </Slider>
        <div className="flex justify-between text-xs tabular-nums text-muted">
          {MARKS.map((mark) => (
            <span key={mark}>{mark === 0 ? t("rateLimits.lastfmDelay.instant") : mark}</span>
          ))}
        </div>

        <p className="text-sm text-muted">
          {t("rateLimits.lastfmDelay.estimate", { count: SAMPLE_TRACK_COUNT, duration: estimate })}
        </p>

        {!isPolite && (
          <Alert status="warning">
            <Alert.Content>
              <Alert.Description>{t("rateLimits.lastfmDelay.warning")}</Alert.Description>
            </Alert.Content>
          </Alert>
        )}
      </div>
    </div>
  );
}
