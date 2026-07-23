"use client";

import { PaintTakeoverArtwork } from "./PaintTakeoverArtwork";
import { usePaintTakeover } from "./usePaintTakeover";
import styles from "./PaintTakeoverSection.module.css";

const TAKEOVER_SURFACE_PATH =
  "M-20 330 C280 395 620 360 970 286 C1320 212 1660 124 1940 -20 L1940 1450 L-20 1450Z";

export function PaintTakeoverSection({ debug = false }: { debug?: boolean }) {
  const sectionRef = usePaintTakeover({ debug });

  return (
    <main className={styles.page}>
      <section className={styles.approach} aria-label="Uvod u paint takeover dokaz">
        <div className={styles.approachFrame}>
          <p>Interaction proof / Phase 2</p>
          <div>
            <span>Mirna površina</span>
            <strong>Priprema pre promene.</strong>
          </div>
          <span className={styles.approachIndex}>00 / ulaz</span>
        </div>
      </section>

      <section
        ref={sectionRef}
        className={styles.section}
        aria-labelledby="paint-takeover-proof-title"
        data-debug-enabled={debug || undefined}
      >
        <div className={styles.introContinuation} aria-hidden="true" />
        <div className={styles.stickyViewport} data-takeover-viewport>
          <div className={styles.takeoverSurface} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <defs>
                <radialGradient id="takeover-surface-magenta" cx="0" cy="0" r="1" gradientTransform="translate(1250 760) rotate(154) scale(820 520)">
                  <stop offset="0" stopColor="#c51765" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#c51765" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="takeover-surface-blue" cx="0" cy="0" r="1" gradientTransform="translate(1660 800) rotate(-142) scale(760 520)">
                  <stop offset="0" stopColor="#195ac6" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#195ac6" stopOpacity="0" />
                </radialGradient>
              </defs>
              <path
                d={TAKEOVER_SURFACE_PATH}
                fill="var(--takeover-canvas)"
              />
              <path
                d={TAKEOVER_SURFACE_PATH}
                fill="url(#takeover-surface-magenta)"
              />
              <path
                d={TAKEOVER_SURFACE_PATH}
                fill="url(#takeover-surface-blue)"
              />
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
          <div className={styles.artwork} aria-hidden="true">
            <PaintTakeoverArtwork />
          </div>
          <div className={styles.contentShade} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <defs>
                <radialGradient
                  id="takeover-shade-radial"
                  cx="307"
                  cy="939"
                  gradientTransform="matrix(1 0 0 0.706 0 276)"
                  gradientUnits="userSpaceOnUse"
                  r="1114"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.9" />
                  <stop offset="0.78" stopColor="#05060b" stopOpacity="0" />
                </radialGradient>
                <linearGradient
                  id="takeover-shade-horizontal"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="1920"
                  y1="0"
                  y2="0"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.84" />
                  <stop offset="0.26" stopColor="#05060b" stopOpacity="0.84" />
                  <stop offset="0.44" stopColor="#05060b" stopOpacity="0.48" />
                  <stop offset="0.72" stopColor="#05060b" stopOpacity="0" />
                </linearGradient>
                <linearGradient
                  id="takeover-shade-vertical"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="0"
                  y1="328"
                  y2="1420"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.18" />
                  <stop offset="0.32" stopColor="#05060b" stopOpacity="0" />
                  <stop offset="1" stopColor="#05060b" stopOpacity="0.16" />
                </linearGradient>
                <linearGradient
                  id="takeover-shade-mobile-vertical"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="0"
                  y1="328"
                  y2="1420"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.22" />
                  <stop offset="0.22" stopColor="#05060b" stopOpacity="0.22" />
                  <stop offset="0.46" stopColor="#05060b" stopOpacity="0" />
                  <stop offset="1" stopColor="#05060b" stopOpacity="0.9" />
                </linearGradient>
                <linearGradient
                  id="takeover-shade-mobile-horizontal"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="1920"
                  y1="0"
                  y2="0"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.54" />
                  <stop offset="0.86" stopColor="#05060b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <g className={styles.shadeDesktop}>
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#takeover-shade-radial)" />
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#takeover-shade-horizontal)" />
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#takeover-shade-vertical)" />
              </g>
              <g className={styles.shadeMobile}>
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#takeover-shade-mobile-vertical)" />
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#takeover-shade-mobile-horizontal)" />
              </g>
            </svg>
          </div>

          <header className={styles.proofHeader}>
            <span>Paint takeover</span>
            <span>Technical proof · 18 strokes</span>
          </header>

          <div className={styles.copy}>
            <p className={styles.eyebrow}>Izvan površine</p>
            <h1 id="paint-takeover-proof-title">
              Boja nije sloj.
              <br />
              Boja je pokret.
            </h1>
            <p className={styles.description}>
              Sistem završne obrade u kome se priprema, preciznost i karakter
              susreću u jednom potezu.
            </p>
          </div>

          <div className={styles.progressRail} aria-hidden="true">
            <span className={styles.progressLine} />
          </div>

          <div className={styles.scrollHint} aria-hidden="true">
            <span />
            Skrolujte kroz poteze
          </div>

          {debug ? (
            <aside className={styles.debugPanel} aria-label="Paint takeover dijagnostika">
              <strong>Scroll dijagnostika</strong>
              <dl>
                <div>
                  <dt>Progress</dt>
                  <dd data-debug-progress>0.0000</dd>
                </div>
                <div>
                  <dt>Faza</dt>
                  <dd data-debug-phase>Mirno stanje</dd>
                </div>
                <div>
                  <dt>Aktivne grupe</dt>
                  <dd data-debug-active>0 / 18</dd>
                </div>
                <div>
                  <dt>Reduced motion</dt>
                  <dd data-debug-reduced>ne</dd>
                </div>
              </dl>
            </aside>
          ) : null}
        </div>
      </section>
    </main>
  );
}
