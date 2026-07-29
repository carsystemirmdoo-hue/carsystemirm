"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { HybridPaintTakeoverArtwork } from "./HybridPaintTakeoverArtwork";
import {
  LIGHT_COVER_PATH,
  paintTakeoverReviewModes,
  TAKEOVER_SURFACE_PATH,
} from "./paintTakeoverMotionConfig";
import type {
  FinalHeroManifest,
  FinalReviewMode,
  PaintTakeoverDebugSnapshot,
} from "./paintTakeoverTypes";
import { usePaintTakeoverMotion } from "./usePaintTakeoverMotion";
import styles from "./PaintTakeoverFinal.module.css";

export type {
  FinalHeroManifest,
  FinalReviewMode,
} from "./paintTakeoverTypes";

type PaintTakeoverFinalProps = {
  heroArtwork: string;
  manifest: FinalHeroManifest;
  debug: boolean;
  initialMode: FinalReviewMode;
};

export function PaintTakeoverFinal({
  heroArtwork,
  manifest,
  debug,
  initialMode,
}: PaintTakeoverFinalProps) {
  const entrySectionRef = useRef<HTMLElement>(null);
  const heroArtworkRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<FinalReviewMode>(initialMode);
  const [debugSnapshot, setDebugSnapshot] =
    useState<PaintTakeoverDebugSnapshot>({
    progress: 0,
    phase: "Approach",
    activeGroups: 0,
    viewportWidth: 0,
    reducedMotion: false,
  });

  usePaintTakeoverMotion({
    sectionRef: entrySectionRef,
    heroArtworkRef,
    manifest,
    mode,
    debug,
    onDebugSnapshot: setDebugSnapshot,
  });

  return (
    <main className={styles.page}>
      <section
        className={styles.preEntry}
        aria-labelledby="paint-takeover-final-pre-title"
      >
        <div className={styles.preEntryHeader}>
          <span>Carsystem / Surface system</span>
          <span>Preview 01</span>
        </div>
        <div className={styles.preEntryCopy}>
          <p>Mirna površina</p>
          <h1 id="paint-takeover-final-pre-title">
            PRIPREMA PRE
            <br />
            PROMENE.
          </h1>
          <p className={styles.preEntryDescription}>
            Kontrolisana preciznost priprema prostor pre nego što boja preuzme
            kadar.
          </p>
        </div>
        <span className={styles.scrollCue}>Scroll / ulaz</span>
      </section>

      <section
        ref={entrySectionRef}
        className={styles.entrySection}
        data-mode={mode}
        aria-labelledby="paint-takeover-final-title"
      >
        <div className={styles.stickyViewport}>
          <div className={styles.takeoverSurface} aria-hidden="true">
            <svg
              focusable="false"
              preserveAspectRatio="none"
              viewBox="0 0 1920 1420"
            >
              <defs>
                <radialGradient
                  id="final-surface-magenta"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientTransform="translate(1260 770) rotate(154) scale(830 530)"
                >
                  <stop offset="0" stopColor="#c51765" stopOpacity="0.23" />
                  <stop offset="1" stopColor="#c51765" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                  id="final-surface-blue"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientTransform="translate(1660 790) rotate(-142) scale(770 520)"
                >
                  <stop offset="0" stopColor="#195ac6" stopOpacity="0.22" />
                  <stop offset="1" stopColor="#195ac6" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path d={TAKEOVER_SURFACE_PATH} fill="var(--takeover-canvas)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#final-surface-magenta)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#final-surface-blue)" />
            </svg>
          </div>

          <div className={styles.backgroundArtwork} aria-hidden="true" />
          <HybridPaintTakeoverArtwork
            ref={heroArtworkRef}
            className={styles.heroArtwork}
            artwork={heroArtwork}
          />
          <div className={styles.contentContrast} aria-hidden="true" />
          <div className={styles.contrastDebug} aria-hidden="true">
            <span>Text contrast field</span>
          </div>

          <div className={styles.lightCover} aria-hidden="true">
            <svg
              focusable="false"
              preserveAspectRatio="none"
              viewBox="0 0 1920 1420"
            >
              <path d={LIGHT_COVER_PATH} fill="var(--intro-surface)" />
              <path
                className={styles.surfaceBrushMass}
                d="M604 356 L674 322 L748 306 L786 313 L724 342 L652 366Z M1012 282 L1074 252 L1144 232 L1192 237 L1126 270 L1056 292Z M1460 172 L1522 140 L1592 112 L1642 110 L1580 146 L1510 180Z"
              />
              <circle className={styles.surfaceDrop} cx="346" cy="382" r="7" />
              <circle className={styles.surfaceDrop} cx="386" cy="403" r="2.8" />
              <circle className={styles.surfaceDrop} cx="720" cy="342" r="4" />
              <circle className={styles.surfaceDrop} cx="1180" cy="236" r="6" />
              <circle
                className={styles.surfaceDropBlue}
                cx="1500"
                cy="138"
                r="5"
              />
              <circle
                className={styles.surfaceDropBlue}
                cx="1560"
                cy="127"
                r="2.4"
              />
            </svg>
          </div>

          <header className={styles.takeoverHeader}>
            <span>Carsystem / R-M</span>
            <span>Final hybrid system</span>
          </header>

          <div className={styles.copy}>
            <p className={styles.eyebrow}>IZVAN POVRŠINE</p>
            <h2 id="paint-takeover-final-title">
              <span>BOJA NIJE SLOJ.</span>
              <span>BOJA JE POKRET.</span>
            </h2>
            <p className={styles.description}>
              Sistem završne obrade u kome se priprema, preciznost i karakter
              susreću u jednom potezu.
            </p>
            <Link className={styles.primaryCta} href="/program">
              ISTRAŽITE SISTEME
              <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <div className={styles.sequenceIndex} aria-hidden="true">
            <span>01 / 03</span>
            <span />
          </div>

          <nav className={styles.reviewToggle} aria-label="Development review mode">
            {paintTakeoverReviewModes.map((option) => (
              <button
                key={option.mode}
                type="button"
                aria-pressed={mode === option.mode}
                onClick={() => setMode(option.mode)}
              >
                {option.label}
              </button>
            ))}
          </nav>
        </div>

        {debug ? (
          <aside className={styles.debugPanel} aria-label="Final motion dijagnostika">
            <strong>FINAL MOTION DIJAGNOSTIKA</strong>
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
                <dt>Aktivne grupe</dt>
                <dd>{debugSnapshot.activeGroups} / 32</dd>
              </div>
              <div>
                <dt>Režim</dt>
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
              <div>
                <dt>SVG DOM</dt>
                <dd>{manifest.finalStats.totalSvgDomElements}</dd>
              </div>
            </dl>
          </aside>
        ) : null}
      </section>

      <section className={styles.nextBlock} aria-labelledby="final-next-title">
        <div>
          <span>Sistem se nastavlja</span>
          <h2 id="final-next-title">
            SLEDEĆA
            <br />
            POVRŠINA.
          </h2>
          <p>
            Završni kadar ostaje stabilan pre nego što se ritam stranice vrati
            osnovnom dizajnu.
          </p>
        </div>
        <span className={styles.nextIndex}>02 / 03</span>
      </section>
    </main>
  );
}
