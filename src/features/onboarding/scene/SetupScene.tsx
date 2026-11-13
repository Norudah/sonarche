import { cn } from "@heroui/react";
import { type CSSProperties, type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";

import type { SceneState } from "@/features/onboarding/scene/sceneState";
import { Swap } from "@/shared/motion/Swap";

import "@/features/onboarding/scene/setupScene.css";

/*
 * The ark beside the setup steps, mirroring them: on its cradles while the
 * engine is missing, loaded crate by crate during the install, afloat once
 * it runs, listening while the key is set up.
 *
 * A deliberate exception to "nothing decorative animates" (motion/tokens.ts),
 * confined to this screen. All of it is CSS and stops under reduced motion.
 *
 * Geometry is the brand mark's 24-unit grid (docs/brand/) at 13×, in a
 * 416 × 656 frame centred on the panel.
 */

const FRAME = { halfWidth: 208, halfHeight: 328 };

// Period 48: the waves loop by sliding one period.
const WAVE = (() => {
  let path = "M-1488 0q12 -5 24 0";
  for (let x = -1464; x < 1920; x += 24) path += "t24 0";
  return `${path}L1920 1200L-1488 1200Z`;
})();

const HATCH = Array.from({ length: 16 }, (_, index) => 60 + index * 20)
  .map((x) => `M${x} 436L${x - 6} 444`)
  .join("");

const CABIN = "M7.5 12V9.75C7.5 8.85 8.4 8.2 9.7 8 10.5 7.88 13.5 7.88 14.3 8 15.6 8.2 16.5 8.85 16.5 9.75V12Z";

/** Loaded in this order: the outer amber pair anchors the drawing last. */
const CRATES = [
  { x: 3, y: 9, width: 2, height: 3, amber: true },
  { x: 5.1, y: 10, width: 1.5, height: 2, amber: false },
  { x: 17.4, y: 10, width: 1.5, height: 2, amber: false },
  { x: 19, y: 9, width: 2, height: 3, amber: true },
] as const;

function Crate({ crate, aboard }: { crate: (typeof CRATES)[number]; aboard: boolean }) {
  const { x, y, width, height, amber } = crate;
  const [body, band] = amber ? ["#efa831", "#fae1b8"] : ["#3d4097", "#818cf9"];
  return (
    <g className="setup-scene-crate" data-aboard={aboard || undefined}>
      <rect
        className="ghost"
        x={x + 0.06}
        y={y + 0.06}
        width={width - 0.12}
        height={height - 0.12}
        rx={amber ? 0.45 : 0.4}
        fill="none"
        strokeWidth={0.11}
        strokeDasharray="0.32 0.24"
      />
      <g className="fill">
        <rect x={x} y={y} width={width} height={height} rx={amber ? 0.5 : 0.45} fill={body} />
        <rect x={x} y={y} width={width} height={amber ? 0.45 : 0.4} rx={amber ? 0.22 : 0.2} fill={band} />
        <rect x={x} y={y + (amber ? 1.3 : 0.9)} width={width} height={amber ? 0.5 : 0.45} fill={band} />
      </g>
    </g>
  );
}

function Ark({ state, headClip }: { state: SceneState; headClip: string }) {
  return (
    <g className="setup-scene-ark" data-afloat={state.afloat || undefined}>
      <g transform="translate(52 139) scale(13)">
        <g className="setup-scene-onde" data-onde={state.onde} fill="#6163f2">
          <rect x="9.56" y="5.8" width="0.5" height="1.25" rx="0.25" />
          <rect x="10.44" y="4.8" width="0.5" height="2.25" rx="0.25" />
          <rect x="11.31" y="3.8" width="0.5" height="3.25" rx="0.25" />
          <rect x="12.19" y="5.05" width="0.5" height="2" rx="0.25" />
          <rect x="13.06" y="4.3" width="0.5" height="2.75" rx="0.25" />
          <rect x="13.94" y="5.55" width="0.5" height="1.5" rx="0.25" />
        </g>

        <path d={CABIN} fill="#c5cbef" />
        <g clipPath={`url(#${headClip})`}>
          <rect x="7.5" y="7.8" width="9" height="0.85" fill="#e2e7fc" />
          <rect x="7.5" y="11.4" width="9" height="0.6" fill="#a5aede" />
        </g>
        <g className="setup-scene-eyes">
          <rect x="9" y="9.05" width="2" height="2" rx="0.75" fill="#222652" />
          <rect x="13" y="9.05" width="2" height="2" rx="0.75" fill="#222652" />
          <circle cx="9.6" cy="9.65" r="0.42" fill="#818cf9" />
          <circle cx="13.6" cy="9.65" r="0.42" fill="#818cf9" />
        </g>

        {CRATES.map((crate, index) => (
          <Crate key={crate.x} crate={crate} aboard={state.cargo > index} />
        ))}

        <rect x="1.6" y="12" width="20.8" height="1.1" rx="0.55" fill="#818cf9" />
        <path
          d="M2.2 13.2h19.6q.75 0 .65.75l-.45 2.6q-.6 3.25-3.4 3.25H5.4q-2.8 0-3.4-3.25l-.45-2.6q-.1-.75.65-.75Z"
          fill="#3d4097"
        />
        <path d="M2.2 13.2h19.6q.75 0 .65.75H1.55q-.1-.75.65-.75Z" fill="#4f52c1" />
        <path d="M3.7 16.5h16.6l-.3 1.15q-.75 2.45-2.9 2.45H6.9q-2.15 0-2.9-2.45Z" fill="#2e3172" />
        <path d="M3.7 16.5h16.6l-.14.55H3.84Z" fill="#3d4097" />
        <g fill="#818cf9">
          <circle cx="5.6" cy="15" r="0.45" />
          <circle cx="9.7" cy="15" r="0.45" />
          <circle cx="14.3" cy="15" r="0.45" />
          <circle cx="18.4" cy="15" r="0.45" />
        </g>
      </g>
    </g>
  );
}

function Dock({ stranded }: { stranded: boolean }) {
  return (
    <>
      <g className="setup-scene-ground" strokeLinecap="round">
        <line x1="44" y1="430" x2="372" y2="430" strokeWidth="1.5" />
        <path d={HATCH} strokeWidth="1" />
      </g>
      <g className="setup-scene-cradle" strokeWidth="1.2" strokeLinejoin="round">
        <path d="M132 430L138 400H170L176 430Z" />
        <path d="M240 430L246 400H278L284 430Z" />
      </g>
      {/* The third crate, tipped over on the quay. */}
      {stranded && (
        <g transform="translate(318 403) rotate(-7)">
          <rect width="20" height="26" rx="5.5" fill="#3d4097" />
          <rect width="20" height="5" rx="2.6" fill="#818cf9" />
          <rect y="11.5" width="20" height="5.5" fill="#818cf9" />
        </g>
      )}
    </>
  );
}

function Wave({ y, fill, className, delay }: { y: number; fill: string; className: string; delay?: string }) {
  return (
    <g className="setup-scene-rise" style={delay ? { animationDelay: delay } : undefined}>
      <g transform={`translate(0 ${y})`}>
        <path className={className} fill={`url(#${fill})`} d={WAVE} />
      </g>
    </g>
  );
}

const GLOW_OPACITY: Record<SceneState["glow"], number> = { low: 0.25, mid: 0.55, full: 1 };

interface SetupSceneProps {
  state: SceneState;
  /** Opened up to the whole window, for the entrance into the app. */
  expanded?: boolean;
  /** Over the water, below the ark (the entrance's welcome). */
  children?: ReactNode;
}

export function SetupScene({ state, expanded = false, children }: SetupSceneProps) {
  const { t } = useTranslation("onboarding");
  const id = useId();
  const ids = { head: `${id}-head`, sea: `${id}-sea`, seaBack: `${id}-sea-back` };

  return (
    <>
      <section className="setup-scene" data-expanded={expanded || undefined} aria-hidden>
        <div className="setup-scene-dots" style={{ opacity: state.afloat ? 0 : 1 }} />

        <div className="setup-scene-stage">
          <div className="setup-scene-glow" style={{ opacity: GLOW_OPACITY[state.glow] }} />

          <svg className="absolute inset-0 size-full overflow-visible">
            <defs>
              <clipPath id={ids.head}>
                <path d={CABIN} />
              </clipPath>
              {/* In user space, so the colour settles at the sea's surface depth
                  however far down the water runs. */}
              <linearGradient id={ids.sea} x1="0" y1="0" x2="0" y2="340" gradientUnits="userSpaceOnUse">
                <stop offset="0" className="setup-scene-sea-front-top" />
                <stop offset="1" className="setup-scene-sea-front-bottom" />
              </linearGradient>
              <linearGradient id={ids.seaBack} x1="0" y1="0" x2="0" y2="340" gradientUnits="userSpaceOnUse">
                <stop offset="0" className="setup-scene-sea-back-top" />
                <stop offset="1" className="setup-scene-sea-back-bottom" />
              </linearGradient>
            </defs>

            {/* Nested and overflowing, so the frame stays centred as the scene widens. */}
            <svg x="50%" y="50%" overflow="visible">
              <g transform={`translate(${-FRAME.halfWidth} ${-FRAME.halfHeight})`}>
                <g className="setup-scene-rings" data-rings={state.rings} fill="none" strokeWidth="1.5">
                  {[0, 1, 2].map((ring) => (
                    <circle key={ring} cx="210" cy="206" r="70" style={{ "--ring": ring } as CSSProperties} />
                  ))}
                </g>

                {state.afloat ? (
                  <Wave y={362} fill={ids.seaBack} className="setup-scene-wave-back" />
                ) : (
                  <Dock stranded={state.stranded} />
                )}

                <Ark state={state} headClip={ids.head} />

                {state.afloat && <Wave y={374} fill={ids.sea} className="setup-scene-wave-front" delay="0.08s" />}
              </g>
            </svg>
          </svg>
        </div>

        {children}
      </section>

      <div className="setup-scene-frame" data-hidden={expanded || undefined}>
        <div className="absolute inset-x-6 bottom-[22px] flex flex-col gap-1">
          <span className="flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-[0.12em] text-accent uppercase">
            <span className={cn("size-1.5 rounded-full bg-accent", state.busy && "setup-scene-pulse")} />
            <Swap swapKey={state.label} mode="cross">
              {t(`scene.label.${state.label}`)}
            </Swap>
          </span>
          <Swap swapKey={state.caption} mode="cross" className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
            {t(`scene.caption.${state.caption}`)}
          </Swap>
        </div>
      </div>
    </>
  );
}
