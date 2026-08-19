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
import {
  ACTIVE_ATTRIBUTE,
  createChromeOwnership,
  probeLineFor,
  resolveTakeoverChrome,
} from "./paintTakeoverChrome";
import { resolveTakeoverScene } from "./paintTakeoverScene";
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
    let previousProgress: number | null = null;
    let direction: PaintTakeoverDirection = "idle";
    /**
     * Vizuelni prikaz sekcije sme samo napred: jednom odigrano ostaje
     * odigrano, reverse skrol ga ne vraća unazad niti resetuje. Chrome/FAB
     * (`nextState`, `syncPageChrome`) i dalje prate pravi `progress`, da se
     * `.mobileLocator` ispravno vrati kad se korisnik odskroluje od sekcije.
     */
    let maxProgress = 0;

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

    /**
     * Header temu drži isključivo geometrija: probe linija ispod sticky
     * Headera i stvarne granice sekcije. Nema smera skrola, nema zapamćenog
     * stanja, pa je isti rezultat i za skok, i za reload, i za resize.
     *
     * `clear()` otpušta vlasništvo bez ostatka — ranije je ostajao prag
     * chapter signala (`CHAPTER_FLOOR`), pa je Header i posle izlaska,
     * unmount-a i route promene nosio deo tamne teme.
     */
    const ownership = createChromeOwnership({
      root,
      enabled: controlPageChrome,
    });

    const clearChrome = () => {
      paintState = null;
      ownership.clear();
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
        if (progress > maxProgress) maxProgress = progress;
        const timeline = toTimeline(
          approach,
          maxProgress,
          entryShareFor(entryLead, scrollRange),
        );
        // Header tema: probe linija ispod sticky Headera protiv stvarnih
        // granica sekcije. Jedina tačka odlučivanja, ista u oba smera skrola.
        const chrome = resolveTakeoverChrome({
          sectionTop: bounds.top,
          sectionBottom: bounds.bottom,
          /*
           * Visina Headera, ne njegova trenutna donja ivica: header se pri
           * skrolu nadole sakriva (`data-scroll-hidden`), pa bi rect.bottom
           * vratio negativnu vrednost i probe linija bi zavisila od SMERA
           * skrola — tačno ono što ovde ne sme da postoji.
           */
          probeLine: probeLineFor(
            document.querySelector<HTMLElement>("header")?.offsetHeight,
          ),
        });
        const chapter = chrome.chapter;
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

        const nextState = chrome.phase;

        if (debug) {
          section.dataset.paintDebugProgress = progress.toFixed(5);
          section.dataset.paintDebugTimeline = timeline.toFixed(5);
          section.dataset.paintDebugChapter = chapter.toFixed(4);
          section.dataset.paintDebugDirection = direction;
        }
        publishState(nextState);
        ownership.sync(chrome);

        const mobile = window.innerWidth <= 720;
        const forceStatic =
          reducedMotion ||
          mode === "hero-static" ||
          mode === "mask-debug" ||
          mode === "text-contrast";
        const showMotion = mode === "final" || mode === "hero-motion";
        /*
         * Ceo kadar je jedna čista funkcija timeline-a (vidi
         * `paintTakeoverScene.mjs`). Ovde ostaje samo upis u CSS varijable, pa
         * nijedan sloj ne može da dobije sopstvenu fazu mimo timeline-a — a
         * baš to je bio `outro`, koji je posle završene animacije gasio poteze
         * i zatamnjivao tekst.
         */
        const scene = resolveTakeoverScene({
          timeline,
          windows: TIMELINE,
          mode,
          reducedMotion,
          mobile,
          washDisabled,
          hasArtwork: animateArtworkGroups || animateLinework,
        });
        const colorWashOpacity = scene.colorWashOpacity;

        section.dataset.reducedMotion = reducedMotion ? "true" : "false";
        section.style.setProperty(
          "--surface-offset",
          `${scene.surfaceOffsetSvh.toFixed(3)}svh`,
        );
        section.style.setProperty(
          "--artwork-offset",
          `${scene.artworkOffsetSvh.toFixed(3)}svh`,
        );
        section.style.setProperty(
          "--background-opacity",
          scene.backgroundOpacity.toFixed(4),
        );
        section.style.setProperty(
          "--background-scale",
          scene.backgroundScale.toFixed(5),
        );
        section.style.setProperty(
          "--background-x",
          `${scene.backgroundXVw.toFixed(3)}vw`,
        );
        section.style.setProperty(
          "--background-y",
          `${scene.backgroundYPx.toFixed(3)}px`,
        );
        section.style.setProperty(
          "--hero-global-opacity",
          scene.heroOpacity.toFixed(4),
        );
        section.style.setProperty(
          "--content-opacity",
          scene.contentOpacity.toFixed(4),
        );
        section.style.setProperty(
          "--content-offset",
          `${scene.contentOffsetPx.toFixed(3)}px`,
        );
        section.style.setProperty(
          "--contrast-opacity",
          scene.contrastOpacity.toFixed(4),
        );
        section.style.setProperty(
          "--color-wash-opacity",
          colorWashOpacity.toFixed(4),
        );

        const lineworkProgress = scene.lineworkProgress;
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
      clearChrome();
    };

    const clearChromeOnNavigation = () => clearChrome();
    /*
     * Back/Forward iz bfcache-a vraća stranicu sa živim listenerima ali bez
     * scroll događaja: bez ovoga bi prvi kadar posle povratka nosio temu koju
     * je `pagehide` obrisao, iako je viewport i dalje u sekciji.
     */
    const restoreOnPageShow = () => requestUpdate();
    window.addEventListener("pagehide", clearChromeOnNavigation);
    window.addEventListener("popstate", clearChromeOnNavigation);
    window.addEventListener("pageshow", restoreOnPageShow);

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
        // Margine su šire od kadra da posmatrač počne da prati pre nego što
        // granica sekcije stigne do probe linije; prelaz teme se time nikad ne
        // odigrava u trenutku kada slušanje tek počinje.
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
      window.removeEventListener("pageshow", restoreOnPageShow);
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
