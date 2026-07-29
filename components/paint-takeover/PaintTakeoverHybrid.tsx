"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PaintTakeoverHybrid.module.css";

const TAKEOVER_SURFACE_PATH =
  "M-20 330 C280 395 620 360 970 286 C1320 212 1660 124 1940 -20 L1940 1450 L-20 1450Z";

const LIGHT_COVER_PATH =
  "M-20 -20 H1940 L1940 -20 C1660 124 1320 212 970 286 C620 360 280 395 -20 330Z";

const HERO_GROUP_COUNT = 32;

export type HybridViewMode = "hybrid" | "background" | "hero";

type PaintTakeoverHybridProps = {
  heroArtwork: string;
  debug: boolean;
  initialMode: HybridViewMode;
};

type DebugSnapshot = {
  progress: number;
  phase: string;
  viewportWidth: number;
  reducedMotion: boolean;
};

const modeLabels: Array<{ mode: HybridViewMode; label: string }> = [
  { mode: "hybrid", label: "HYBRID ON" },
  { mode: "background", label: "BACKGROUND ONLY" },
  { mode: "hero", label: "HERO SVG ONLY" },
];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function mapProgress(progress: number, start: number, end: number) {
  const normalized = clamp((progress - start) / (end - start));
  return normalized * normalized * (3 - 2 * normalized);
}

function phaseFor(progress: number) {
  if (progress < 0.06) return "Svetla priprema";
  if (progress < 0.25) return "Organski ulaz";
  if (progress < 0.52) return "Šest glavnih gestova";
  if (progress < 0.78) return "Porodični reveal";
  return "Hibridna kompozicija";
}

export function PaintTakeoverHybrid({
  heroArtwork,
  debug,
  initialMode,
}: PaintTakeoverHybridProps) {
  const entrySectionRef = useRef<HTMLElement>(null);
  const debugProgressRef = useRef(-1);
  const [mode, setMode] = useState<HybridViewMode>(initialMode);
  const [debugSnapshot, setDebugSnapshot] = useState<DebugSnapshot>({
    progress: 0,
    phase: "Svetla priprema",
    viewportWidth: 0,
    reducedMotion: false,
  });

  useEffect(() => {
    const section = entrySectionRef.current;
    if (!section) return;

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let animationFrame = 0;

    const update = () => {
      animationFrame = 0;
      const bounds = section.getBoundingClientRect();
      const scrollRange = Math.max(1, section.offsetHeight - window.innerHeight);
      const progress = clamp(-bounds.top / scrollRange);
      const reducedMotion = reducedMotionQuery.matches;

      const surface = reducedMotion ? 1 : mapProgress(progress, 0.025, 0.34);
      const background = reducedMotion ? 1 : mapProgress(progress, 0.1, 0.52);
      const mainStrokes = reducedMotion
        ? 1
        : mapProgress(progress, 0.14, 0.56);
      const familyStrokes = reducedMotion
        ? 1
        : mapProgress(progress, 0.29, 0.68);
      const sprayStrokes = reducedMotion
        ? 1
        : mapProgress(progress, 0.36, 0.74);
      const detailStrokes = reducedMotion
        ? 1
        : mapProgress(progress, 0.44, 0.8);
      const content = reducedMotion ? 1 : mapProgress(progress, 0.5, 0.78);

      section.style.setProperty(
        "--surface-offset",
        `${((1 - surface) * 70).toFixed(3)}svh`,
      );
      section.style.setProperty(
        "--background-opacity",
        background.toFixed(4),
      );
      section.style.setProperty(
        "--background-scale",
        (1 + (1 - background) * 0.055).toFixed(5),
      );
      section.style.setProperty(
        "--background-x",
        `${((1 - background) * -1.5).toFixed(3)}vw`,
      );
      section.style.setProperty(
        "--background-y",
        `${((1 - background) * 20).toFixed(3)}px`,
      );
      section.style.setProperty(
        "--main-opacity",
        mainStrokes.toFixed(4),
      );
      section.style.setProperty(
        "--main-clip",
        `${((1 - mainStrokes) * 100).toFixed(3)}%`,
      );
      section.style.setProperty(
        "--main-offset-x",
        `${((1 - mainStrokes) * 7).toFixed(3)}vw`,
      );
      section.style.setProperty(
        "--main-left-offset",
        `${((1 - mainStrokes) * -7).toFixed(3)}vw`,
      );
      section.style.setProperty(
        "--main-offset-y",
        `${((1 - mainStrokes) * 8).toFixed(3)}svh`,
      );
      section.style.setProperty(
        "--main-top-offset",
        `${((1 - mainStrokes) * -8).toFixed(3)}svh`,
      );
      section.style.setProperty(
        "--family-opacity",
        familyStrokes.toFixed(4),
      );
      section.style.setProperty(
        "--family-clip",
        `${((1 - familyStrokes) * 100).toFixed(3)}%`,
      );
      section.style.setProperty(
        "--family-offset",
        `${((1 - familyStrokes) * 18).toFixed(3)}px`,
      );
      section.style.setProperty(
        "--spray-opacity",
        sprayStrokes.toFixed(4),
      );
      section.style.setProperty(
        "--spray-clip",
        `${((1 - sprayStrokes) * 100).toFixed(3)}%`,
      );
      section.style.setProperty(
        "--detail-opacity",
        detailStrokes.toFixed(4),
      );
      section.style.setProperty(
        "--detail-clip",
        `${((1 - detailStrokes) * 100).toFixed(3)}%`,
      );
      section.style.setProperty(
        "--content-opacity",
        content.toFixed(4),
      );
      section.style.setProperty(
        "--content-offset",
        `${((1 - content) * 24).toFixed(3)}px`,
      );

      if (
        debug &&
        (Math.abs(progress - debugProgressRef.current) >= 0.0005 ||
          progress === 0 ||
          progress === 1)
      ) {
        debugProgressRef.current = progress;
        setDebugSnapshot({
          progress,
          phase: phaseFor(progress),
          viewportWidth: window.innerWidth,
          reducedMotion,
        });
      }
    };

    const requestUpdate = () => {
      if (animationFrame) return;
      animationFrame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    reducedMotionQuery.addEventListener("change", requestUpdate);

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reducedMotionQuery.removeEventListener("change", requestUpdate);
    };
  }, [debug]);

  return (
    <main className={styles.page}>
      <section
        className={styles.preEntry}
        aria-labelledby="paint-takeover-hybrid-pre-title"
      >
        <div className={styles.preEntryFrame}>
          <p>Interaction proof / Phase 3B</p>
          <div>
            <span>Mirna površina</span>
            <h1 id="paint-takeover-hybrid-pre-title">
              PRIPREMA PRE
              <br />
              PROMENE.
            </h1>
          </div>
          <span className={styles.preEntryIndex}>00 / hibrid</span>
        </div>
      </section>

      <section
        ref={entrySectionRef}
        className={styles.entrySection}
        data-mode={mode}
        aria-labelledby="paint-takeover-hybrid-title"
      >
        <div className={styles.stickyViewport}>
          <div className={styles.takeoverSurface} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <defs>
                <radialGradient
                  id="hybrid-surface-magenta"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientTransform="translate(1250 760) rotate(154) scale(820 520)"
                >
                  <stop offset="0" stopColor="#c51765" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#c51765" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                  id="hybrid-surface-blue"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientTransform="translate(1660 800) rotate(-142) scale(760 520)"
                >
                  <stop offset="0" stopColor="#195ac6" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#195ac6" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path d={TAKEOVER_SURFACE_PATH} fill="var(--takeover-canvas)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#hybrid-surface-magenta)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#hybrid-surface-blue)" />
            </svg>
          </div>

          <div className={styles.backgroundArtwork} aria-hidden="true" />

          <div
            className={styles.heroArtwork}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: heroArtwork }}
          />

          <div className={styles.contentContrast} aria-hidden="true" />

          <div className={styles.lightCover} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <path d={LIGHT_COVER_PATH} fill="var(--intro-surface)" />
              <path
                className={styles.surfaceBrushMass}
                d="M604 356 L674 322 L748 306 L786 313 L724 342 L652 366Z M1012 282 L1074 252 L1144 232 L1192 237 L1126 270 L1056 292Z M1460 172 L1522 140 L1592 112 L1642 110 L1580 146 L1510 180Z"
              />
              <circle className={styles.surfaceDrop} cx="346" cy="382" r="7" />
              <circle className={styles.surfaceDrop} cx="386" cy="403" r="2.8" />
              <circle className={styles.surfaceDrop} cx="720" cy="342" r="4" />
              <circle className={styles.surfaceDrop} cx="766" cy="359" r="2" />
              <circle className={styles.surfaceDrop} cx="1180" cy="236" r="6" />
              <circle className={styles.surfaceDrop} cx="1230" cy="230" r="2.6" />
              <circle className={styles.surfaceDropBlue} cx="1500" cy="138" r="5" />
              <circle className={styles.surfaceDropBlue} cx="1560" cy="127" r="2.4" />
            </svg>
          </div>

          <header className={styles.proofHeader}>
            <span>Paint takeover / hybrid runtime</span>
            <span>Phase 3B · {HERO_GROUP_COUNT} hero groups</span>
          </header>

          <div className={styles.copy}>
            <p className={styles.eyebrow}>IZVAN POVRŠINE</p>
            <h2 id="paint-takeover-hybrid-title">
              BOJANJE JE SLOJ.
              <br />
              BOJA JE POKRET.
            </h2>
            <p className={styles.description}>
              Sistem završne obrade u kome se priprema, preciznost i karakter
              susreću u jednom potezu.
            </p>
          </div>

          <div className={styles.viewToggle} role="group" aria-label="Hybrid prikaz">
            {modeLabels.map((item) => (
              <button
                key={item.mode}
                type="button"
                aria-pressed={mode === item.mode}
                onClick={() => setMode(item.mode)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {debug ? (
          <aside className={styles.debugPanel} aria-label="Hybrid dijagnostika">
            <strong>HYBRID DIJAGNOSTIKA</strong>
            <dl>
              <div>
                <dt>Progress</dt>
                <dd>{debugSnapshot.progress.toFixed(4)}</dd>
              </div>
              <div>
                <dt>Faza</dt>
                <dd>{debugSnapshot.phase}</dd>
              </div>
              <div>
                <dt>Hero grupe</dt>
                <dd>{HERO_GROUP_COUNT}</dd>
              </div>
              <div>
                <dt>Prikaz</dt>
                <dd>{mode}</dd>
              </div>
              <div>
                <dt>Viewport</dt>
                <dd>{debugSnapshot.viewportWidth}px</dd>
              </div>
              <div>
                <dt>Reduced motion</dt>
                <dd>{debugSnapshot.reducedMotion ? "da" : "ne"}</dd>
              </div>
            </dl>
          </aside>
        ) : null}
      </section>

      <section className={styles.reviewTail} aria-label="Kraj Phase 3B pregleda">
        <span>Phase 3B / hybrid review</span>
        <p>Raster nosi gustinu. SVG nosi gest.</p>
      </section>
    </main>
  );
}
