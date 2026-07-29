"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import styles from "./PaintTakeoverReferenceAssimilation.module.css";

type ArtworkMetrics = {
  paths: number;
  circles: number;
  ellipses: number;
  groups: number;
  masks: number;
  filters: number;
  bytes: number;
  runtimeDomNodes: number;
};

export type ReferenceAssimilationCard = {
  index: number;
  label: string;
  family: string;
  origin: string;
  direction: string;
  originalId: string;
  proofId: string;
  source: string;
  sourceLabel: string;
  currentSvg: string;
  adaptedSvg: string;
  adaptedStaticSvg: string;
  adaptedDebugSvg: string;
  metrics: {
    current: ArtworkMetrics;
    adapted: ArtworkMetrics;
    runtimeDomIncrease: number;
  };
};

type PaintTakeoverReferenceAssimilationProps = {
  cards: ReferenceAssimilationCard[];
};

type PreviewMode = "current" | "adapted";
type ThemeMode = "light" | "dark" | "carsystem";
type PlaybackDirection = "forward" | "reverse" | "static" | "scroll";
type ProofVariables = CSSProperties & Record<`--${string}`, string | number>;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max);
}

function stage(progress: number, start: number, end: number) {
  if (end <= start) return progress >= end ? 1 : 0;
  const normalized = clamp((progress - start) / (end - start));
  return normalized * normalized * (3 - 2 * normalized);
}

function proofVariables(progress: number): ProofVariables {
  const contact = stage(progress, 0, 0.12);
  const core = stage(progress, 0.04, 0.67);
  const bristles = stage(progress, 0.2, 0.78);
  const fragments = stage(progress, 0.36, 0.86);
  const near = stage(progress, 0.48, 0.9);
  const far = stage(progress, 0.6, 0.96);
  const release = stage(progress, 0.76, 1);

  return {
    "--proof-mask-offset": (1 - core).toFixed(5),
    "--proof-contact-opacity": contact.toFixed(4),
    "--proof-contact-scale": (0.72 + contact * 0.28).toFixed(4),
    "--proof-bristle-opacity": bristles.toFixed(4),
    "--proof-fragment-opacity": fragments.toFixed(4),
    "--proof-fragment-shift": `${((1 - fragments) * 10).toFixed(3)}px`,
    "--proof-near-opacity": near.toFixed(4),
    "--proof-far-opacity": far.toFixed(4),
    "--proof-release-opacity": release.toFixed(4),
    "--proof-release-shift": `${((1 - release) * -14).toFixed(3)}px`,
  };
}

const fullRevealVariables = proofVariables(1);
const debugRevealVariables = proofVariables(0.68);

function SvgMarkup({
  markup,
  className,
  style,
  maskDebug = false,
}: {
  markup: string;
  className?: string;
  style?: ProofVariables;
  maskDebug?: boolean;
}) {
  return (
    <div
      className={className}
      data-mask-debug={maskDebug ? "true" : "false"}
      style={style}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export function PaintTakeoverReferenceAssimilation({
  cards,
}: PaintTakeoverReferenceAssimilationProps) {
  const scrollSectionRef = useRef<HTMLElement>(null);
  const playbackFrameRef = useRef(0);
  const progressRef = useRef(0);
  const playbackActiveRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [previewMode, setPreviewMode] =
    useState<PreviewMode>("adapted");
  const [theme, setTheme] = useState<ThemeMode>("carsystem");
  const [maskDebug, setMaskDebug] = useState(false);
  const [direction, setDirection] =
    useState<PlaybackDirection>("scroll");
  const [reducedMotion, setReducedMotion] = useState(false);

  const activeCard = cards[activeIndex];
  const variables = proofVariables(progress);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(media.matches);
      if (media.matches) {
        setProgress(1);
        setDirection("static");
      }
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const section = scrollSectionRef.current;
    if (!section) return;
    let scrollFrame = 0;

    const update = () => {
      scrollFrame = 0;
      if (playbackActiveRef.current) return;
      if (reducedMotion) {
        progressRef.current = 1;
        setProgress(1);
        setDirection("static");
        return;
      }
      const bounds = section.getBoundingClientRect();
      const range = Math.max(1, section.offsetHeight - window.innerHeight);
      const nextProgress = clamp(-bounds.top / range);
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      setDirection("scroll");
    };

    const requestUpdate = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    return () => {
      if (scrollFrame) window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
    };
  }, [reducedMotion]);

  useEffect(
    () => () => {
      if (playbackFrameRef.current) {
        window.cancelAnimationFrame(playbackFrameRef.current);
      }
    },
    [],
  );

  const stopPlayback = useCallback(() => {
    playbackActiveRef.current = false;
    if (playbackFrameRef.current) {
      window.cancelAnimationFrame(playbackFrameRef.current);
      playbackFrameRef.current = 0;
    }
  }, []);

  const play = useCallback(
    (nextDirection: "forward" | "reverse") => {
      stopPlayback();
      const target = nextDirection === "forward" ? 1 : 0;
      if (reducedMotion) {
        progressRef.current = target;
        setProgress(target);
        setDirection("static");
        return;
      }

      const startValue = progressRef.current;
      const distance = Math.abs(target - startValue);
      if (distance < 0.0001) {
        progressRef.current = target;
        setProgress(target);
        setDirection(nextDirection);
        return;
      }

      const duration = Math.max(520, distance * 1700);
      const startedAt = performance.now();
      playbackActiveRef.current = true;
      setDirection(nextDirection);
      setPreviewMode("adapted");

      const tick = (now: number) => {
        const elapsed = clamp((now - startedAt) / duration);
        const eased = elapsed * elapsed * (3 - 2 * elapsed);
        const nextValue =
          startValue + (target - startValue) * eased;
        progressRef.current = nextValue;
        setProgress(nextValue);

        if (elapsed < 1) {
          playbackFrameRef.current = window.requestAnimationFrame(tick);
          return;
        }

        playbackActiveRef.current = false;
        playbackFrameRef.current = 0;
      };

      playbackFrameRef.current = window.requestAnimationFrame(tick);
    },
    [reducedMotion, stopPlayback],
  );

  const setStatic = useCallback(() => {
    stopPlayback();
    progressRef.current = 1;
    setProgress(1);
    setDirection("static");
    setPreviewMode("adapted");
  }, [stopPlayback]);

  const selectCard = useCallback(
    (nextIndex: number) => {
      stopPlayback();
      setActiveIndex((nextIndex + cards.length) % cards.length);
    },
    [cards.length, stopPlayback],
  );

  return (
    <main className={styles.page} data-theme={theme}>
      <section
        ref={scrollSectionRef}
        className={styles.scrollSection}
        aria-labelledby="reference-assimilation-title"
      >
        <div className={styles.stickyViewport}>
          <header className={styles.header}>
            <div>
              <p>Pre-Phase 4 / isolated proof</p>
              <h1 id="reference-assimilation-title">
                CARSYSTEM BRUSH
                <br />
                ASSIMILATION
              </h1>
            </div>
            <dl>
              <div>
                <dt>Stroke</dt>
                <dd>
                  {String(activeCard.index).padStart(2, "0")} /{" "}
                  {String(cards.length).padStart(2, "0")}
                </dd>
              </div>
              <div>
                <dt>Progress</dt>
                <dd>{progress.toFixed(3)}</dd>
              </div>
              <div>
                <dt>Motion</dt>
                <dd>{reducedMotion ? "reduced" : direction}</dd>
              </div>
            </dl>
          </header>

          <nav className={styles.controls} aria-label="Proof controls">
            <div className={styles.controlGroup}>
              <button
                type="button"
                onClick={() => selectCard(activeIndex - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => selectCard(activeIndex + 1)}
              >
                Next
              </button>
            </div>

            <div className={styles.controlGroup}>
              <button
                type="button"
                aria-pressed={previewMode === "current"}
                onClick={() => setPreviewMode("current")}
              >
                Current
              </button>
              <button
                type="button"
                aria-pressed={previewMode === "adapted"}
                onClick={() => setPreviewMode("adapted")}
              >
                Adapted
              </button>
              <button type="button" onClick={setStatic}>
                Static
              </button>
            </div>

            <div className={styles.controlGroup}>
              <button type="button" onClick={() => play("forward")}>
                Play forward
              </button>
              <button type="button" onClick={() => play("reverse")}>
                Play reverse
              </button>
            </div>

            <label className={styles.scrubber}>
              <span>Scrub 0–1</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.001"
                value={progress}
                onChange={(event) => {
                  stopPlayback();
                  const nextProgress = Number(event.currentTarget.value);
                  progressRef.current = nextProgress;
                  setProgress(nextProgress);
                  setDirection("static");
                  setPreviewMode("adapted");
                }}
              />
            </label>

            <button
              type="button"
              aria-pressed={maskDebug}
              onClick={() => setMaskDebug((value) => !value)}
            >
              Mask debug
            </button>

            <div className={styles.controlGroup} aria-label="Proof theme">
              <button
                type="button"
                aria-pressed={theme === "light"}
                onClick={() => setTheme("light")}
              >
                Black on white
              </button>
              <button
                type="button"
                aria-pressed={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                White on dark
              </button>
              <button
                type="button"
                aria-pressed={theme === "carsystem"}
                onClick={() => setTheme("carsystem")}
              >
                Carsystem color
              </button>
            </div>
          </nav>

          <section className={styles.heroReview} aria-live="polite">
            <div className={styles.heroMeta}>
              <div>
                <span>{activeCard.family}</span>
                <h2>{activeCard.label}</h2>
              </div>
              <p>
                {activeCard.originalId} · {activeCard.origin} ·{" "}
                {activeCard.direction}
              </p>
            </div>

            <div
              className={styles.heroStage}
              data-preview={previewMode}
              data-mask-debug={maskDebug ? "true" : "false"}
              style={variables}
            >
              {previewMode === "current" ? (
                <SvgMarkup
                  className={styles.heroSvg}
                  markup={activeCard.currentSvg}
                  style={fullRevealVariables}
                />
              ) : (
                <SvgMarkup
                  className={styles.heroSvg}
                  markup={activeCard.adaptedSvg}
                  maskDebug={maskDebug}
                  style={variables}
                />
              )}
              <div className={styles.stageReadout}>
                <span>
                  {previewMode === "adapted" ? "Adapted reveal" : "Current static"}
                </span>
                <strong>{progress.toFixed(3)}</strong>
              </div>
            </div>
          </section>

          <div className={styles.cardRail}>
            {cards.map((card, cardIndex) => (
              <article
                key={card.originalId}
                className={styles.comparisonCard}
                hidden={cardIndex !== activeIndex}
              >
                <div className={styles.comparisonGrid}>
                  <section className={styles.tile}>
                    <span>A / Current</span>
                    <SvgMarkup
                      className={styles.tileArtwork}
                      markup={card.currentSvg}
                      style={fullRevealVariables}
                    />
                  </section>

                  <section className={styles.tile}>
                    <span>B / Reference source</span>
                    {/* The selected library assets are trusted local SVG files. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={card.source} alt="" />
                    <small>{card.sourceLabel}</small>
                  </section>

                  <section className={styles.tile}>
                    <span>C / Adapted static</span>
                    <SvgMarkup
                      className={styles.tileArtwork}
                      markup={card.adaptedStaticSvg}
                      style={fullRevealVariables}
                    />
                  </section>

                  <button
                    className={styles.actionTile}
                    type="button"
                    onClick={() => play("forward")}
                  >
                    <span>D / Forward reveal</span>
                    <strong>Contact → core → release</strong>
                  </button>

                  <button
                    className={styles.actionTile}
                    type="button"
                    onClick={() => play("reverse")}
                  >
                    <span>E / Reverse reveal</span>
                    <strong>Release → core → contact</strong>
                  </button>

                  <section
                    className={styles.tile}
                    data-mask-debug="true"
                  >
                    <span>F / Mask debug</span>
                    <SvgMarkup
                      className={styles.tileArtwork}
                      markup={card.adaptedDebugSvg}
                      maskDebug
                      style={debugRevealVariables}
                    />
                  </section>
                </div>

                <dl className={styles.metrics}>
                  <div>
                    <dt>Paths</dt>
                    <dd>
                      {card.metrics.current.paths} →{" "}
                      {card.metrics.adapted.paths}
                    </dd>
                  </div>
                  <div>
                    <dt>Circles / ellipses</dt>
                    <dd>
                      {card.metrics.current.circles +
                        card.metrics.current.ellipses}{" "}
                      →{" "}
                      {card.metrics.adapted.circles +
                        card.metrics.adapted.ellipses}
                    </dd>
                  </div>
                  <div>
                    <dt>Masks / filters</dt>
                    <dd>
                      {card.metrics.adapted.masks} /{" "}
                      {card.metrics.adapted.filters}
                    </dd>
                  </div>
                  <div>
                    <dt>Fragment bytes</dt>
                    <dd>{card.metrics.adapted.bytes.toLocaleString("sr-RS")}</dd>
                  </div>
                  <div>
                    <dt>Runtime DOM</dt>
                    <dd>+{card.metrics.runtimeDomIncrease}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Reference proof only</span>
        <p>
          Odobreni hybrid i njegovih 32 top-level grupa nisu izmenjeni.
        </p>
      </footer>
    </main>
  );
}
