"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PaintTakeoverFinalArtEntry.module.css";

const TAKEOVER_SURFACE_PATH =
  "M-20 330 C280 395 620 360 970 286 C1320 212 1660 124 1940 -20 L1940 1450 L-20 1450Z";

const LIGHT_COVER_PATH =
  "M-20 -20 H1940 L1940 -20 C1660 124 1320 212 970 286 C620 360 280 395 -20 330Z";

const GROUP_COUNT = 109;

type PaintTakeoverFinalArtEntryProps = {
  artwork: string;
  entryArtwork: string;
  debug: boolean;
};

type DebugSnapshot = {
  progress: number;
  phase: string;
  viewportWidth: number;
  reducedMotion: boolean;
};

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function mapProgress(progress: number, start: number, end: number) {
  const normalized = clamp((progress - start) / (end - start));
  return normalized * normalized * (3 - 2 * normalized);
}

function phaseFor(progress: number) {
  if (progress < 0.07) return "Svetla priprema";
  if (progress < 0.24) return "Organski ulaz";
  if (progress < 0.5) return "Dijagonalni brush pull";
  if (progress < 0.76) return "Razvijanje final art-a";
  return "Finalna kompozicija";
}

export function PaintTakeoverFinalArtEntry({
  artwork,
  entryArtwork,
  debug,
}: PaintTakeoverFinalArtEntryProps) {
  const entrySectionRef = useRef<HTMLElement>(null);
  const debugFrameRef = useRef(0);
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

      const surfaceProgress = reducedMotion
        ? 1
        : mapProgress(progress, 0.035, 0.39);
      const brushProgress = reducedMotion
        ? 1
        : mapProgress(progress, 0.09, 0.48);
      const artworkProgress = reducedMotion
        ? 1
        : mapProgress(progress, 0.3, 0.7);
      const contentProgress = reducedMotion
        ? 1
        : mapProgress(progress, 0.44, 0.74);

      section.style.setProperty(
        "--surface-offset",
        `${((1 - surfaceProgress) * 69).toFixed(3)}svh`,
      );
      section.style.setProperty(
        "--brush-offset-x",
        `${((1 - brushProgress) * -7).toFixed(3)}vw`,
      );
      section.style.setProperty(
        "--brush-offset-y",
        `${((1 - brushProgress) * 12).toFixed(3)}svh`,
      );
      section.style.setProperty(
        "--brush-clip",
        `${((1 - brushProgress) * 100).toFixed(3)}%`,
      );
      section.style.setProperty(
        "--brush-opacity",
        brushProgress.toFixed(4),
      );
      section.style.setProperty(
        "--art-offset",
        `${((1 - artworkProgress) * 24).toFixed(3)}px`,
      );
      section.style.setProperty(
        "--art-clip",
        `${((1 - artworkProgress) * 22).toFixed(3)}%`,
      );
      section.style.setProperty(
        "--art-opacity",
        artworkProgress.toFixed(4),
      );
      section.style.setProperty(
        "--content-offset",
        `${((1 - contentProgress) * 24).toFixed(3)}px`,
      );
      section.style.setProperty(
        "--content-opacity",
        contentProgress.toFixed(4),
      );

      if (
        debug &&
        (Math.abs(progress - debugFrameRef.current) >= 0.0005 ||
          progress === 0 ||
          progress === 1)
      ) {
        debugFrameRef.current = progress;
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
        aria-labelledby="paint-takeover-pre-entry-title"
      >
        <div className={styles.preEntryFrame}>
          <p>Interaction proof / Phase 3A</p>
          <div>
            <span>Mirna površina</span>
            <h1 id="paint-takeover-pre-entry-title">
              PRIPREMA PRE
              <br />
              PROMENE.
            </h1>
          </div>
          <span className={styles.preEntryIndex}>00 / ulaz</span>
        </div>
      </section>

      <section
        ref={entrySectionRef}
        className={styles.entrySection}
        aria-labelledby="paint-takeover-live-title"
      >
        <div className={styles.stickyViewport}>
          <div className={styles.takeoverSurface} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <defs>
                <radialGradient
                  id="entry-surface-magenta"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientTransform="translate(1250 760) rotate(154) scale(820 520)"
                >
                  <stop offset="0" stopColor="#c51765" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#c51765" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                  id="entry-surface-blue"
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
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#entry-surface-magenta)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#entry-surface-blue)" />
            </svg>
          </div>

          <div
            className={styles.artworkLayer}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: artwork }}
          />

          <div
            className={styles.entryBrushLayer}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: entryArtwork }}
          />

          <div className={styles.contentShade} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <defs>
                <radialGradient
                  id="entry-shade-radial"
                  cx="307"
                  cy="939"
                  gradientTransform="matrix(1 0 0 0.706 0 276)"
                  gradientUnits="userSpaceOnUse"
                  r="1114"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.64" />
                  <stop offset="0.7" stopColor="#05060b" stopOpacity="0.1" />
                  <stop offset="0.9" stopColor="#05060b" stopOpacity="0" />
                </radialGradient>
                <linearGradient
                  id="entry-shade-horizontal"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="1920"
                  y1="0"
                  y2="0"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.62" />
                  <stop offset="0.3" stopColor="#05060b" stopOpacity="0.42" />
                  <stop offset="0.58" stopColor="#05060b" stopOpacity="0.16" />
                  <stop offset="1" stopColor="#05060b" stopOpacity="0.04" />
                </linearGradient>
                <linearGradient
                  id="entry-shade-vertical"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="0"
                  y1="328"
                  y2="1420"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.22" />
                  <stop offset="0.34" stopColor="#05060b" stopOpacity="0" />
                  <stop offset="1" stopColor="#05060b" stopOpacity="0.2" />
                </linearGradient>
              </defs>
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#entry-shade-radial)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#entry-shade-horizontal)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#entry-shade-vertical)" />
            </svg>
          </div>

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
            <span>Paint takeover / live entry</span>
            <span>Phase 3A · {GROUP_COUNT} strokes</span>
          </header>

          <div className={styles.copy}>
            <p className={styles.eyebrow}>IZVAN POVRŠINE</p>
            <h2 id="paint-takeover-live-title">
              BOJANJE JE SLOJ.
              <br />
              BOJA JE POKRET.
            </h2>
            <p className={styles.description}>
              Sistem završne obrade u kome se priprema, preciznost i karakter
              susreću u jednom potezu.
            </p>
          </div>

          <div className={styles.scrollHint} aria-hidden="true">
            <span />
            Scroll u oba smera
          </div>
        </div>

        {debug ? (
          <aside className={styles.debugPanel} aria-label="Scroll dijagnostika">
            <strong>SCROLL DIJAGNOSTIKA</strong>
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
                <dt>SVG grupe</dt>
                <dd>{GROUP_COUNT}</dd>
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

      <section className={styles.reviewTail} aria-label="Kraj Phase 3A pregleda">
        <span>Phase 3A / live review</span>
        <p>Vratite scroll za proveru reverzibilnog ulaza.</p>
      </section>
    </main>
  );
}
