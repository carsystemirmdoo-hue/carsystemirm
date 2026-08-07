"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import {
  clamp,
  clipForGroup,
  easeBrushStroke,
  ENTRY_LEAD_VH,
  entryShareFor,
  LINE_WINDOWS,
  mapProgress,
  normalize,
  phaseFor,
  remapStrokeWindow,
  TIMELINE,
  toTimeline,
} from "./paintTakeoverMotionConfig";
import type {
  FinalHeroManifest,
  FinalReviewMode,
  PaintTakeoverDebugSnapshot,
  PaintTakeoverDirection,
  PaintTakeoverRuntimeSnapshot,
  PaintTakeoverState,
} from "./paintTakeoverTypes";

type UsePaintTakeoverMotionOptions = {
  sectionRef: RefObject<HTMLElement | null>;
  heroArtworkRef?: RefObject<HTMLDivElement | null>;
  lineworkRef?: RefObject<HTMLDivElement | null>;
  manifest?: FinalHeroManifest;
  mode?: FinalReviewMode;
  debug?: boolean;
  onDebugSnapshot?: (snapshot: PaintTakeoverDebugSnapshot) => void;
  onRuntimeSnapshot?: (snapshot: PaintTakeoverRuntimeSnapshot) => void;
  controlPageChrome?: boolean;
  washDisabled?: boolean;
};

const ACTIVE_ATTRIBUTE = "data-paint-takeover";
/** Kontinualni signal koji nose header, orb i sekcije ispod takeovera. */
const CHAPTER_VARIABLE = "--paint-chapter";
/** Signal approach faze — koriste ga painterly potezi u prethodnom bloku. */
const APPROACH_VARIABLE = "--paint-approach";
/**
 * Koliko "novog poglavlja" ostaje u sekcijama ispod takeovera. Ne vraća se na
 * nulu jer je cilj da se oseti da je sajt prešao u drugu etapu.
 */
const CHAPTER_FLOOR = 0.34;
/** Preko koliko viewport visina chapter signal opada nakon izlaska. */
const CHAPTER_DECAY_VIEWPORTS = 1.2;
const ENTER_START = 0.08;
const ENTER_ACTIVE = 0.15;
const ENTER_REVERSE = 0.07;
const ENTER_BEFORE = 0.025;
const EXIT_START = 0.95;
const EXIT_ACTIVE_REVERSE = 0.925;
const EXIT_AFTER = 0.998;
const EXIT_REVERSE = 0.985;

function initialStateFor(progress: number): PaintTakeoverState {
  if (progress < ENTER_START) return "before";
  if (progress < ENTER_ACTIVE) return "entering";
  if (progress < EXIT_START) return "active";
  if (progress < EXIT_AFTER) return "leaving";
  return "after";
}

function resolveState(
  current: PaintTakeoverState,
  progress: number,
): PaintTakeoverState {
  let next = current;

  for (let index = 0; index < 4; index += 1) {
    const previous = next;

    if (next === "before" && progress >= ENTER_START) {
      next = "entering";
    } else if (next === "entering") {
      if (progress <= ENTER_BEFORE) next = "before";
      else if (progress >= ENTER_ACTIVE) next = "active";
    } else if (next === "active") {
      if (progress <= ENTER_REVERSE) next = "entering";
      else if (progress >= EXIT_START) next = "leaving";
    } else if (next === "leaving") {
      if (progress <= EXIT_ACTIVE_REVERSE) next = "active";
      else if (progress >= EXIT_AFTER) next = "after";
    } else if (next === "after" && progress <= EXIT_REVERSE) {
      next = "leaving";
    }

    if (next === previous) break;
  }

  return next;
}

function stateControlsChrome(
  state: PaintTakeoverState,
  sectionBottom: number,
  headerBottom: number,
) {
  return (
    state === "entering" ||
    state === "active" ||
    state === "leaving" ||
    (state === "after" && sectionBottom > headerBottom)
  );
}

export function usePaintTakeoverMotion({
  sectionRef,
  heroArtworkRef,
  lineworkRef,
  manifest,
  mode = "final",
  debug = false,
  onDebugSnapshot,
  onRuntimeSnapshot,
  controlPageChrome = false,
  washDisabled = false,
}: UsePaintTakeoverMotionOptions) {
  const debugProgressRef = useRef(-1);

  useLayoutEffect(() => {
    const section = sectionRef.current;
    const heroLayer = heroArtworkRef?.current ?? null;
    const lineworkLayer = lineworkRef?.current ?? null;
    if (!section) return;

    const root = document.documentElement;
    const groups = manifest?.groups ?? [];
    const groupElements = new Map(
      groups.map((group) => [
        group.id,
        heroLayer?.querySelector<SVGGElement>(`#${group.id}`) ?? null,
      ]),
    );
    const animateArtworkGroups = Boolean(heroLayer && groups.length);
    const lineElements = lineworkLayer
      ? Array.from(
          lineworkLayer.querySelectorAll<SVGPathElement>("[data-paint-line]"),
        )
      : [];
    const detailReveal =
      lineworkLayer?.querySelector<SVGRectElement>(
        "[data-paint-detail-reveal]",
      ) ?? null;
    const animateLinework = lineElements.length > 0;
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let animationFrame = 0;
    let listening = false;
    let paintState: PaintTakeoverState | null = null;
    let chromeAttribute: PaintTakeoverState | null = null;
    let previousProgress: number | null = null;
    let direction: PaintTakeoverDirection = "idle";

    if (debug) {
      section.dataset.resolvedGroups = String(
        [...groupElements.values()].filter(Boolean).length,
      );
      section.dataset.resolvedLines = String(lineElements.length);
    }

    const publishState = (nextState: PaintTakeoverState) => {
      if (paintState === nextState) return;
      paintState = nextState;
    };

    const syncPageChrome = (
      nextState: PaintTakeoverState,
      sectionBottom: number,
    ) => {
      if (!controlPageChrome) return;
      const headerBottom =
        document.querySelector<HTMLElement>("header")?.getBoundingClientRect()
          .bottom ?? 88;
      const nextAttribute = stateControlsChrome(
        nextState,
        sectionBottom,
        headerBottom,
      )
        ? nextState
        : null;

      if (chromeAttribute === nextAttribute) return;
      chromeAttribute = nextAttribute;

      if (nextAttribute) {
        root.setAttribute(ACTIVE_ATTRIBUTE, nextState);
      } else {
        root.removeAttribute(ACTIVE_ATTRIBUTE);
      }
    };

    /**
     * `resting` zadržava chapter signal kada posmatrač prestane da prati
     * sekciju: ispod takeovera ostaje prag novog poglavlja, iznad se vraća na
     * nulu. Bez toga bi izlazak iz observer opsega naglo obrisao boju.
     */
    const clearChrome = (resting: number | null = null) => {
      paintState = null;
      chromeAttribute = null;
      root.removeAttribute(ACTIVE_ATTRIBUTE);
      root.style.removeProperty(APPROACH_VARIABLE);
      if (resting === null) {
        root.style.removeProperty(CHAPTER_VARIABLE);
      } else {
        root.style.setProperty(CHAPTER_VARIABLE, resting.toFixed(4));
      }
    };

    /** Sekcija je iznad viewporta → poglavlje ispod zadržava prag. */
    const restingChapter = () => {
      const bounds = section.getBoundingClientRect();
      return bounds.bottom <= 0 ? CHAPTER_FLOOR : 0;
    };

    const update = () => {
      const activeRafCallbacks = animationFrame ? 1 : 0;
      animationFrame = 0;

      try {
        const bounds = section.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const scrollRange = Math.max(1, section.offsetHeight - viewportHeight);
        const progress = clamp(-bounds.top / scrollRange);
        // Approach: 0 kada je gornja ivica sekcije ENTRY_LEAD_VH viewporta
        // ispod vrha, 1 kada se sekcija pinuje. Cela ova faza se odigrava u
        // bloku partnerske mreže.
        //
        // Lead je namerno kraći od jednog viewporta: udeo u timeline-u se
        // izvodi iz istih tih piksela, pa je brzina timeline-a ista pre i posle
        // pinovanja. Ranije je approach išao preko cele viewport visine dok je
        // sticky kadar imao upola manje piksela za 82% timeline-a — na pinu je
        // brzina skakala ~7.9× i to je bio izvor sevanja.
        const entryLead = Math.max(1, viewportHeight * ENTRY_LEAD_VH);
        const approach = clamp((entryLead - bounds.top) / entryLead);
        const timeline = toTimeline(
          approach,
          progress,
          entryShareFor(entryLead, scrollRange),
        );
        // Odlazak: koliko je sekcija otišla iznad viewporta — nosi chapter
        // signal naniže bez naglog reseta.
        const departure = clamp(
          -bounds.bottom / (viewportHeight * CHAPTER_DECAY_VIEWPORTS),
        );
        // Chapter signal: raste kroz ulazak, drži se kroz takeover, pa opada
        // do praga koji ostaje u sekcijama ispod.
        const chapter =
          mapProgress(timeline, ...TIMELINE.chapter) *
          (1 - departure * (1 - CHAPTER_FLOOR));
        const reducedMotion = reducedMotionQuery.matches;
        if (
          !reducedMotion &&
          bounds.top < viewportHeight &&
          bounds.bottom > 0
        ) {
          section.dataset.motionActive = "true";
        } else {
          delete section.dataset.motionActive;
        }
        if (previousProgress !== null) {
          const delta = progress - previousProgress;
          if (delta > 0.0001) direction = "down";
          else if (delta < -0.0001) direction = "up";
        }
        previousProgress = progress;

        const nextState =
          paintState === null
            ? initialStateFor(progress)
            : resolveState(paintState, progress);

        if (debug) {
          section.dataset.paintDebugProgress = progress.toFixed(5);
          section.dataset.paintDebugTimeline = timeline.toFixed(5);
          section.dataset.paintDebugChapter = chapter.toFixed(4);
          section.dataset.paintDebugDirection = direction;
        }
        publishState(nextState);
        syncPageChrome(nextState, bounds.bottom);

        const mobile = window.innerWidth <= 720;
        const forceStatic =
          reducedMotion ||
          mode === "hero-static" ||
          mode === "mask-debug" ||
          mode === "text-contrast";
        const showBackground =
          mode === "final" ||
          mode === "background" ||
          mode === "text-contrast" ||
          mode === "mask-debug";
        const showMotion = mode === "final" || mode === "hero-motion";
        const surface =
          mode === "final"
            ? reducedMotion
              ? 1
              : mapProgress(timeline, ...TIMELINE.surface)
            : 1;
        const backgroundProgress = showBackground
          ? mode === "final"
            ? reducedMotion
              ? 1
              : mapProgress(timeline, ...TIMELINE.background)
            : 1
          : 0;
        const contentWindow: readonly [number, number] = mobile
          ? TIMELINE.contentMobile
          : TIMELINE.content;
        const content =
          mode === "text-contrast"
            ? 1
            : mode === "final"
              ? reducedMotion
                ? 1
                : mapProgress(timeline, ...contentWindow)
              : 0;
        const finalGlobalArtwork = animateArtworkGroups || animateLinework
          ? 1
          : forceStatic
            ? 1
            : showMotion
              ? mapProgress(
                  timeline,
                  TIMELINE.strokes[0],
                  TIMELINE.strokes[0] + 0.17,
                )
              : 0;
        const holdDrift =
          reducedMotion || mode !== "final"
            ? 0
            : mapProgress(timeline, ...TIMELINE.hold) * -1.6;
        /*
         * Izlazak: 0 kroz celu scenu, 1 pred njen kraj. Gasi painterly slojeve
         * da tamna scena zavrsi kao miran taman kadar i da nijedan potez ne
         * ostane uz prelaz u svetlu komercijalnu zonu.
         */
        const outro =
          reducedMotion || mode !== "final"
            ? 0
            : mapProgress(timeline, ...TIMELINE.outro);
        const settle = 1 - outro;
        const colorWashOpacity = washDisabled
          ? 0
          : reducedMotion
            ? 1
            : mapProgress(timeline, ...TIMELINE.background) * settle;

        section.dataset.reducedMotion = reducedMotion ? "true" : "false";
        // Kontinualni signali na <html>: header, orb i sekcije ispod se boje
        // interpolacijom po ovim vrednostima, pa nema vremenske tranzicije
        // koja bi mogla da odsvetli nezavisno od skrola.
        root.style.setProperty(CHAPTER_VARIABLE, chapter.toFixed(4));
        root.style.setProperty(APPROACH_VARIABLE, approach.toFixed(4));
        /*
         * Wipe ide naniže: krivina je u artworku na ~28.7% kadra, pa offset od
         * -32svh drži tamno tačno iznad gornje ivice, a +102svh ga spušta ispod
         * donje. Ranije je bilo `18 - surface * 90` (kretanje naviše sa dna),
         * zbog čega je pri ulasku ploča ostajala prazno bela.
         */
        section.style.setProperty(
          "--surface-offset",
          `${(-32 + surface * 134).toFixed(3)}svh`,
        );
        section.style.setProperty(
          "--artwork-offset",
          `${((1 - surface) * 18).toFixed(3)}svh`,
        );
        section.style.setProperty(
          "--background-opacity",
          // Podloga zadrzi malo teksture da kadar ne postane ravna ploca.
          (backgroundProgress * (1 - outro * 0.78)).toFixed(4),
        );
        section.style.setProperty(
          "--background-scale",
          (reducedMotion ? 1 : 1 + (1 - backgroundProgress) * 0.015).toFixed(5),
        );
        section.style.setProperty(
          "--background-x",
          `${(reducedMotion ? 0 : (1 - backgroundProgress) * -0.55).toFixed(3)}vw`,
        );
        section.style.setProperty(
          "--background-y",
          `${(reducedMotion ? 0 : (1 - backgroundProgress) * 8 + holdDrift).toFixed(3)}px`,
        );
        section.style.setProperty(
          "--hero-global-opacity",
          // Potezi se gase do nule — oni pripadaju iskljucivo tamnoj sceni.
          (finalGlobalArtwork * settle).toFixed(4),
        );
        section.style.setProperty(
          "--content-opacity",
          // Dizajn tamnog repa drzi tekst na ~0.55 dok scena izlazi.
          (content * (1 - outro * 0.45)).toFixed(4),
        );
        section.style.setProperty(
          "--content-offset",
          `${((1 - content) * 26).toFixed(3)}px`,
        );
        // Smirivanje leve zone ide po svom prozoru, malo pre teksta, da beli
        // tekst nikad ne stigne na još svetlu podlogu.
        const contrastProgress =
          washDisabled || mode !== "final"
            ? mode === "text-contrast"
              ? 1
              : 0
            : reducedMotion
              ? 1
              : mapProgress(timeline, ...TIMELINE.contrast);
        section.style.setProperty(
          "--contrast-opacity",
          (
            washDisabled
              ? 0
              : Math.max(contrastProgress * 0.92, backgroundProgress * 0.4)
          ).toFixed(4),
        );
        section.style.setProperty(
          "--exit-lift",
          `${
            reducedMotion
              ? "0.000"
              : (mapProgress(timeline, 0.96, 1) * -3).toFixed(3)
          }svh`,
        );
        section.style.setProperty(
          "--color-wash-opacity",
          colorWashOpacity.toFixed(4),
        );

        const lineworkProgress = forceStatic
          ? 1
          : showMotion
            ? mapProgress(timeline, ...TIMELINE.strokes)
            : 0;
        let activeLines = 0;
        for (let index = 0; index < lineElements.length; index += 1) {
          const line = lineElements[index];
          const window = LINE_WINDOWS[index] ?? LINE_WINDOWS.at(-1)!;
          // Ease-out umesto smoothstep-a: kontakt četke je trenutan, pa se
          // potez u istom prozoru skrola čita kao brz gest, a ne kao sporo
          // izvlačenje linije.
          const localProgress = easeBrushStroke(
            normalize(lineworkProgress, window[0], window[1]),
          );
          if (localProgress > 0.001 && localProgress < 0.999) {
            activeLines += 1;
          }
          line.style.strokeDashoffset = (1 - localProgress).toFixed(5);
          line.style.opacity = mapProgress(localProgress, 0, 0.08).toFixed(4);
        }
        if (detailReveal) {
          detailReveal.style.opacity = mapProgress(
            lineworkProgress,
            0.76,
            0.96,
          ).toFixed(4);
        }

        let activeGroups = 0;
        for (const group of groups) {
          const element = groupElements.get(group.id);
          if (!element) continue;

          const [strokeStart, strokeEnd] = remapStrokeWindow(
            group.start,
            group.end,
          );
          const localProgress = forceStatic
            ? 1
            : showMotion
              ? mapProgress(timeline, strokeStart, strokeEnd)
              : 0;
          if (localProgress > 0.001 && localProgress < 0.999) {
            activeGroups += 1;
          }
          const contact = mapProgress(localProgress, 0, 0.13);
          const core = mapProgress(localProgress, 0.035, 0.68);
          const bristles = mapProgress(localProgress, 0.2, 0.8);
          const fragments = mapProgress(localProgress, 0.34, 0.88);
          const nearOverspray = mapProgress(localProgress, 0.48, 0.91);
          const farParticles = mapProgress(localProgress, 0.62, 0.97);
          const release = mapProgress(localProgress, 0.76, 1);
          const groupOpacity =
            group.revealMode === "global-fade"
              ? localProgress
              : mapProgress(localProgress, 0, 0.1);
          const directShape = group.adaptationType === "A_DIRECT_SHAPE";
          const pathDriven =
            group.revealMode.includes("path") ||
            group.revealMode.includes("particle");

          element.style.setProperty(
            "--group-progress",
            localProgress.toFixed(5),
          );
          element.style.setProperty(
            "--group-opacity",
            groupOpacity.toFixed(4),
          );
          element.style.setProperty(
            "--group-clip-path",
            directShape || pathDriven
              ? "inset(0)"
              : clipForGroup(localProgress, group.origin, group.direction),
          );
          element.style.setProperty("--part-contact", contact.toFixed(4));
          element.style.setProperty("--part-core", core.toFixed(4));
          element.style.setProperty("--part-bristles", bristles.toFixed(4));
          element.style.setProperty("--part-fragments", fragments.toFixed(4));
          element.style.setProperty("--part-near", nearOverspray.toFixed(4));
          element.style.setProperty("--part-far", farParticles.toFixed(4));
          element.style.setProperty("--part-release", release.toFixed(4));
          element.style.setProperty(
            "--part-shift",
            `${((1 - fragments) * 9).toFixed(3)}px`,
          );
          element.style.setProperty(
            "--release-shift",
            `${((1 - release) * -12).toFixed(3)}px`,
          );
          element.style.setProperty("--path-offset", (1 - core).toFixed(5));

          if (directShape && heroLayer) {
            const suffix = group.id.slice(-2);
            heroLayer.style.setProperty(
              `--hero-mask-offset-${suffix}`,
              (1 - core).toFixed(5),
            );
          }
        }
        activeGroups += activeLines;

        if (
          debug &&
          onDebugSnapshot &&
          (Math.abs(progress - debugProgressRef.current) >= 0.0005 ||
            progress === 0 ||
            progress === 1)
        ) {
          debugProgressRef.current = progress;
          onDebugSnapshot({
            progress,
            phase: phaseFor(timeline),
            activeGroups,
            viewportWidth: window.innerWidth,
            reducedMotion,
          });
        }

        if (debug && onRuntimeSnapshot) {
          const htmlAttribute = root.getAttribute(ACTIVE_ATTRIBUTE);
          onRuntimeSnapshot({
            timestamp: performance.now(),
            progress,
            direction,
            rectTop: bounds.top,
            rectBottom: bounds.bottom,
            stickyActive:
              bounds.top <= 0 && bounds.bottom >= window.innerHeight,
            state: nextState,
            htmlAttribute,
            colorWashOpacity,
            headerVariant: htmlAttribute ? "takeover" : "base",
            washDisabled,
            reducedMotion,
            activeRafCallbacks,
          });
        }
      } catch {
        clearChrome();
      }
    };

    const requestUpdate = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(update);
      }
    };

    const startListening = () => {
      if (listening) return;
      listening = true;
      window.addEventListener("scroll", requestUpdate, { passive: true });
      window.addEventListener("resize", requestUpdate);
      reducedMotionQuery.addEventListener("change", requestUpdate);
      requestUpdate();
    };

    const stopListening = () => {
      if (!listening) return;
      listening = false;
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      reducedMotionQuery.removeEventListener("change", requestUpdate);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
      delete section.dataset.motionActive;
      clearChrome(restingChapter());
    };

    const clearChromeOnNavigation = () => clearChrome();
    window.addEventListener("pagehide", clearChromeOnNavigation);
    window.addEventListener("popstate", clearChromeOnNavigation);

    // Restore the exact scroll-derived state before the browser paints. This
    // covers refreshes, history restoration and client navigation back to a
    // homepage that mounts halfway through the sticky range. The observer
    // only controls continued listening, not the initial visual state.
    update();

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            startListening();
          } else {
            stopListening();
          }
        },
        // Gornja margina mora da pokrije chapter decay ispod sekcije, inače bi
        // posmatrač prestao da prati baš usred opadanja signala.
        { rootMargin: "200% 0px 120% 0px" },
      );
      observer.observe(section);
    } else {
      startListening();
    }

    return () => {
      observer?.disconnect();
      stopListening();
      window.removeEventListener("pagehide", clearChromeOnNavigation);
      window.removeEventListener("popstate", clearChromeOnNavigation);
      clearChrome();
    };
  }, [
    controlPageChrome,
    debug,
    heroArtworkRef,
    lineworkRef,
    manifest?.groups,
    mode,
    onDebugSnapshot,
    onRuntimeSnapshot,
    sectionRef,
    washDisabled,
  ]);
}
