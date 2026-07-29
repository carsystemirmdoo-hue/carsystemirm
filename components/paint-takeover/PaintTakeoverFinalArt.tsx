import { readFile } from "node:fs/promises";
import path from "node:path";
import styles from "./PaintTakeoverFinalArt.module.css";

const TAKEOVER_SURFACE_PATH =
  "M-20 330 C280 395 620 360 970 286 C1320 212 1660 124 1940 -20 L1940 1450 L-20 1450Z";

const LIGHT_COVER_PATH =
  "M-20 -20 H1940 L1940 -20 C1660 124 1320 212 970 286 C620 360 280 395 -20 330Z";

async function loadFinalArtwork() {
  return readFile(
    path.join(
      process.cwd(),
      "public/art/paint-takeover/paint-takeover.svg",
    ),
    "utf8",
  );
}

type PaintTakeoverFinalArtProps = {
  artOnly?: boolean;
};

export async function PaintTakeoverFinalArt({
  artOnly = false,
}: PaintTakeoverFinalArtProps) {
  const finalArtwork = await loadFinalArtwork();

  return (
    <main className={styles.page}>
      <section
        className={styles.approach}
        aria-label="Uvod u finalnu paint takeover kompoziciju"
      >
        <div className={styles.approachFrame}>
          <p>Final artwork / Phase 3A</p>
          <div>
            <span>Mirna površina</span>
            <strong>Priprema pre promene.</strong>
          </div>
          <span className={styles.approachIndex}>00 / ulaz</span>
        </div>
      </section>

      <section
        className={styles.section}
        aria-label={artOnly ? "Finalna paint takeover kompozicija bez teksta" : undefined}
        aria-labelledby={artOnly ? undefined : "paint-takeover-final-art-title"}
      >
        <div className={styles.introContinuation} aria-hidden="true" />
        <div className={styles.stickyViewport}>
          <div className={styles.takeoverSurface} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <defs>
                <radialGradient
                  id="final-surface-magenta"
                  cx="0"
                  cy="0"
                  r="1"
                  gradientTransform="translate(1250 760) rotate(154) scale(820 520)"
                >
                  <stop offset="0" stopColor="#c51765" stopOpacity="0.24" />
                  <stop offset="1" stopColor="#c51765" stopOpacity="0" />
                </radialGradient>
                <radialGradient
                  id="final-surface-blue"
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
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#final-surface-magenta)" />
              <path d={TAKEOVER_SURFACE_PATH} fill="url(#final-surface-blue)" />
            </svg>
          </div>

          <div
            className={styles.artwork}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: finalArtwork }}
          />

          <div className={styles.contentShade} aria-hidden="true">
            <svg focusable="false" preserveAspectRatio="none" viewBox="0 0 1920 1420">
              <defs>
                <radialGradient
                  id="final-shade-radial"
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
                  id="final-shade-horizontal"
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
                  id="final-shade-vertical"
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
                <linearGradient
                  id="final-shade-mobile-vertical"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="0"
                  y1="328"
                  y2="1420"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.24" />
                  <stop offset="0.34" stopColor="#05060b" stopOpacity="0.16" />
                  <stop offset="0.62" stopColor="#05060b" stopOpacity="0.5" />
                  <stop offset="1" stopColor="#05060b" stopOpacity="0.88" />
                </linearGradient>
                <linearGradient
                  id="final-shade-mobile-horizontal"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  x2="1920"
                  y1="0"
                  y2="0"
                >
                  <stop offset="0" stopColor="#05060b" stopOpacity="0.5" />
                  <stop offset="0.72" stopColor="#05060b" stopOpacity="0.12" />
                  <stop offset="1" stopColor="#05060b" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <g className={styles.shadeDesktop}>
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#final-shade-radial)" />
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#final-shade-horizontal)" />
                <path d={TAKEOVER_SURFACE_PATH} fill="url(#final-shade-vertical)" />
              </g>
              <g className={styles.shadeMobile}>
                <path
                  d={TAKEOVER_SURFACE_PATH}
                  fill="url(#final-shade-mobile-vertical)"
                />
                <path
                  d={TAKEOVER_SURFACE_PATH}
                  fill="url(#final-shade-mobile-horizontal)"
                />
              </g>
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

          {!artOnly ? (
            <>
              <header className={styles.proofHeader}>
                <span>Paint takeover / final art</span>
                <span>Static composition · 109 strokes</span>
              </header>

              <div className={styles.copy}>
                <p className={styles.eyebrow}>IZVAN POVRŠINE</p>
                <h1 id="paint-takeover-final-art-title">
                  BOJANJE JE SLOJ.
                  <br />
                  BOJA JE POKRET.
                </h1>
                <p className={styles.description}>
                  Sistem završne obrade u kome se priprema, preciznost i karakter
                  susreću u jednom potezu.
                </p>
              </div>

              <div className={styles.scrollHint} aria-hidden="true">
                <span />
                Statična finalna kompozicija
              </div>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}
