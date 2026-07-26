import { useTranslation } from "react-i18next";

import type { Album } from "@/features/library/albums/albums";

// A compact echo of the album hero's completion gauge. The big ring is hidden
// behind the open drawer, so this keeps the one number the app is about in view
// while editing. Static (no count-up): it is a reminder, not an arrival beat.
const SIZE = 66;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function AlbumCompletionRow({ album }: { album: Album }) {
  const { t } = useTranslation("library");
  // Floor, not round: 99.6% must not read as a complete 100%.
  const percent = Math.floor(album.completeness * 100);
  const isComplete = percent === 100;
  const tone = isComplete ? "text-success" : "text-warning";

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Same left accent rule as the section headings, so the drawer's three
          blocks read as one family. */}
      <div className="flex flex-col gap-0.5 border-l-2 border-accent/30 pl-3.5">
        <p className="text-[0.6875rem] font-semibold tracking-wider text-muted uppercase">
          {t("albumMetadata.completion")}
        </p>
        <p className="text-[0.75rem] text-muted/70">
          {t("albums.stats.taggedCount", { tagged: album.fullyTagged, total: album.tracks.length })}
        </p>
      </div>

      {/* Oversized on purpose (Romain): it may visually spill toward the row
          below, which reads as presence, not a bug. */}
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90" aria-hidden>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-separator"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - percent / 100)}
            className={isComplete ? "stroke-success" : "stroke-warning"}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-base leading-none font-bold tabular-nums ${tone}`}>
            {percent}
            <span className="ml-0.5 text-[0.625rem] font-semibold">%</span>
          </span>
        </div>
      </div>
    </div>
  );
}
