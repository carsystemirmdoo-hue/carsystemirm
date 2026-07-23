"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandEcosystemDesktopCards } from "@/components/home/animations/BrandEcosystemCards";
import { BrandPreviewPanel } from "@/components/home/animations/BrandEcosystemCards";
import { BrandEcosystemControls } from "@/components/home/animations/BrandEcosystemControls";
import { BrandLogoPlate, brandLogos } from "@/components/home/BrandLogoPlate";
import {
  collectSequenceImageSrcs,
  getBrandCatalogPreview,
  programCategories,
  refinishExportFormats,
  resolveExportSequence,
  type RefinishExportFormat,
} from "./refinishSystemsPrograms";
import styles from "@/components/home/CarsystemHomePage.module.css";

const STEP_MS = 4400;
const OUTRO_MS = 3200;
const PRELOAD_TIMEOUT_MS = 8000;

/*
 * Vremenska linija MP4 rendera (render=1). Kraća od preview autoplay-a da bi
 * kompletan video sa pet koraka stao u ~15-20s: stabilan uvodni kadar, koraci,
 * pa završni kadar koji ostaje do kraja videa (bez loop-a i bez fade-outa).
 */
const RENDER_HOLD_MS = 400;
const RENDER_STEP_MS = 3400;
const RENDER_END_MS = 2100;

type StagePhase = "hold" | "run" | "outro";

type RenderBridge = {
  start: () => void;
  meta: () => {
    ready: boolean;
    phase: StagePhase;
    stepIndex: number;
    steps: number;
    holdMs: number;
    stepMs: number;
    endMs: number;
    width: number;
    height: number;
  };
};

declare global {
  interface Window {
    __refinishRender?: RenderBridge;
  }
}

function noop() {}

/** Stanje scene u tačno zadatom trenutku render vremenske linije. */
function stateAtTime(timeMs: number, stepCount: number): {
  phase: StagePhase;
  stepIndex: number;
  withinStepMs: number;
} {
  if (timeMs < RENDER_HOLD_MS) {
    return { phase: "hold", stepIndex: 0, withinStepMs: 0 };
  }

  const runMs = timeMs - RENDER_HOLD_MS;
  const rawIndex = Math.floor(runMs / RENDER_STEP_MS);
  if (rawIndex >= stepCount) {
    return { phase: "outro", stepIndex: stepCount - 1, withinStepMs: 0 };
  }

  return { phase: "run", stepIndex: rawIndex, withinStepMs: runMs - rawIndex * RENDER_STEP_MS };
}

/*
 * Interna scena za snimanje video sadržaja: sačuvani vizuelni sistem bloka
 * „Sistemi za ceo refinish tok." vožen automatskom vremenskom linijom umesto
 * scroll/hover interakcijom. Kadar je fiksni canvas tačnog aspect ratio-a;
 * pointer događaji su isključeni pa nema hover zavisnosti, a sekvenca se
 * završava završnim kadrom i vraća na početak kao čist loop.
 *
 * renderMode (?render=1): režim za MP4 render. Scena ne startuje sama —
 * čeka window.__refinishRender.start(), koju render skripta poziva tek pošto
 * uključi CDP virtual time. Od tog trenutka SVE (tajmeri, CSS tranzicije,
 * progress animacija) teče po virtuelnom satu koji skripta pomera za tačno
 * 1000/fps ms po frame-u, pa je svaki frame određen brojem frame-a, a ne
 * brzinom računara. Bez loop-a: završni kadar ostaje do kraja snimka.
 *
 * renderTimeMs (?render=1&time=MS): statički pregled tačnog trenutka —
 * stanje se računa iz vremena, tranzicije su isključene, a progress je
 * pauziran na tačnom pomaku unutar koraka.
 */
export function RefinishSystemsExportStage({
  format,
  program,
  siteHost,
  renderMode = false,
  renderTimeMs = null,
}: {
  format: RefinishExportFormat;
  program: string | null;
  siteHost: string | null;
  renderMode?: boolean;
  renderTimeMs?: number | null;
}) {
  const { width, height } = refinishExportFormats[format];
  const sequence = useMemo(() => resolveExportSequence(program), [program]);
  const { steps, focusBrandKey, focusCategory } = sequence;
  const isStaticRender = renderMode && renderTimeMs !== null;

  const [ready, setReady] = useState(false);
  const [stepIndexState, setStepIndexState] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [phaseState, setPhaseState] = useState<StagePhase>(renderMode ? "hold" : "run");
  const [renderStarted, setRenderStarted] = useState(false);
  const [scale, setScale] = useState(1);
  const timerRef = useRef<number | null>(null);

  const staticState = isStaticRender ? stateAtTime(renderTimeMs, steps.length) : null;
  const phase = staticState?.phase ?? phaseState;
  const stepIndex = staticState?.stepIndex ?? stepIndexState;

  // Zaključana namenska tema: eksport se uvek snima u dark okruženju.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!hadDark) root.classList.remove("dark");
    };
  }, []);

  // Preload svih logotipa, packshot-ova i fontova pre starta animacije.
  useEffect(() => {
    let cancelled = false;
    const srcs = collectSequenceImageSrcs(sequence);
    const imageJobs = srcs.map(
      (src) =>
        new Promise<void>((resolve) => {
          const image = new window.Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = src;
        }),
    );
    const fontJob =
      "fonts" in document ? document.fonts.ready.then(() => undefined) : Promise.resolve();
    const timeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, PRELOAD_TIMEOUT_MS);
    });

    void Promise.race([
      Promise.all([...imageJobs, fontJob]).then(() => undefined),
      timeout,
    ]).then(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [sequence]);

  // Skaliranje kadra na viewport; u render režimu viewport je tačno kadar.
  useEffect(() => {
    if (renderMode) return undefined;

    function updateScale() {
      setScale(Math.min(window.innerWidth / width, window.innerHeight / height, 1));
    }

    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [renderMode, width, height]);

  // Most ka render skripti: start + trenutno stanje vremenske linije.
  useEffect(() => {
    if (!renderMode) return undefined;

    window.__refinishRender = {
      start: () => setRenderStarted(true),
      meta: () => ({
        ready,
        phase,
        stepIndex,
        steps: steps.length,
        holdMs: RENDER_HOLD_MS,
        stepMs: RENDER_STEP_MS,
        endMs: RENDER_END_MS,
        width,
        height,
      }),
    };

    return () => {
      delete window.__refinishRender;
    };
  }, [renderMode, ready, phase, stepIndex, steps.length, width, height]);

  // Vremenska linija. Preview: koraci -> završni kadar -> loop. Render režim:
  // uvodni hold -> koraci -> završni kadar koji ostaje (skripta seče snimak);
  // tajmere pomera isključivo virtuelni sat render skripte.
  useEffect(() => {
    if (!ready || isStaticRender) return undefined;
    if (renderMode && !renderStarted) return undefined;
    if (renderMode && phaseState === "outro") return undefined;

    const stepMs = renderMode ? RENDER_STEP_MS : STEP_MS;
    const delay =
      phaseState === "hold" ? RENDER_HOLD_MS : phaseState === "outro" ? OUTRO_MS : stepMs;

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;

      if (phaseState === "hold") {
        setPhaseState("run");
        setCycle((value) => value + 1);
        return;
      }

      if (phaseState === "outro") {
        setStepIndexState(0);
        setCycle((value) => value + 1);
        setPhaseState("run");
        return;
      }

      if (stepIndexState < steps.length - 1) {
        setStepIndexState(stepIndexState + 1);
        setCycle((value) => value + 1);
        return;
      }

      setPhaseState("outro");
    }, delay);

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [ready, isStaticRender, renderMode, renderStarted, phaseState, stepIndexState, steps.length]);

  const activeStep = steps[Math.min(stepIndex, steps.length - 1)];
  const activeCategory = programCategories[activeStep.categoryIndex];
  const activePreview = getBrandCatalogPreview(activeStep.brandKey, activeCategory);

  // Jedna crtica po koraku sekvence, sa progresom koji uvek kreće od nule.
  const controlCategories = useMemo(
    () =>
      steps.map((step, index) => ({
        ...programCategories[step.categoryIndex],
        id: `${programCategories[step.categoryIndex].id}-${index}`,
      })),
    [steps],
  );

  const endBrandKey = focusBrandKey ?? "carsystem";
  const endBrand = brandLogos[endBrandKey];
  const stageStyle: CSSProperties & { "--render-fill-delay"?: string } = {
    width,
    height,
    transform: renderMode ? "translate(-50%, -50%)" : `translate(-50%, -50%) scale(${scale})`,
  };
  if (staticState) {
    stageStyle["--render-fill-delay"] = `${-staticState.withinStepMs}ms`;
  }

  return (
    <div className={`${styles.home} ${styles.exportViewport}`}>
      <div
        className={styles.exportStage}
        data-export-format={format}
        data-export-ready={ready ? "true" : "false"}
        data-render-mode={renderMode ? "true" : undefined}
        data-render-static={staticState ? "true" : undefined}
        style={stageStyle}
      >
        <div className={styles.exportScaleLayer}>
          <header className={styles.exportHeader}>
            <div>
              <p className={styles.sectionKicker}>Program proizvoda</p>
              <h2>
                {focusBrandKey
                  ? `${endBrand.name} u refinish toku.`
                  : "Sistemi za ceo refinish tok."}
              </h2>
              {focusCategory ? <p>{focusCategory.title}</p> : null}
            </div>

            <BrandEcosystemControls
              activeIndex={Math.min(stepIndex, controlCategories.length - 1)}
              autoplayMs={renderMode ? RENDER_STEP_MS : STEP_MS}
              categories={controlCategories}
              isAutoplayRunning={ready && phase === "run"}
              onActivate={noop}
              progressCycle={staticState ? stepIndex : cycle}
            />
          </header>

          <div className={styles.exportBody}>
            <div className={styles.exportDeckArea}>
              <div className={styles.programDeckDesktop} aria-label="Program po kategorijama">
                <BrandEcosystemDesktopCards
                  activeIndex={activeStep.categoryIndex}
                  activePreviewBrandKey={activeStep.brandKey}
                  categories={programCategories}
                  onBrandPreview={noop}
                />
              </div>
            </div>

            <div className={styles.exportPanelArea}>
              {activePreview ? (
                <BrandPreviewPanel
                  key={`${staticState ? stepIndex : `${cycle}-${stepIndex}`}`}
                  brandKey={activeStep.brandKey}
                  preview={activePreview}
                  titleId="refinish-export-preview-title"
                />
              ) : null}
            </div>
          </div>
        </div>

        <div
          className={styles.exportEndFrame}
          data-visible={phase === "outro" ? "true" : "false"}
          aria-hidden={phase !== "outro"}
        >
          <div className={styles.exportEndLogo}>
            <BrandLogoPlate brandKey={endBrandKey} />
          </div>
          <strong>Kompletni sistemi za profesionalni refinish</strong>
          {focusCategory ? <span>{focusCategory.title}</span> : null}
          {focusBrandKey ? <span>{endBrand.name} program u ponudi</span> : null}
          {siteHost ? <small>{siteHost}</small> : null}
        </div>

        {!ready ? <p className={styles.exportLoading}>Priprema sadržaja…</p> : null}
      </div>
    </div>
  );
}
