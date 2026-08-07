"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import {
  rmCampaignSlides,
  type RmCampaignSlideData,
} from "@/components/rm-brand/rmBrandData";
import styles from "./RmBrandPage.module.css";

const AUTOPLAY_INTERVAL_MS = 7500;
const MANUAL_PAUSE_MS = 11000;
const IMAGE_PRELOAD_FALLBACK_MS = 2400;
const COVER_FALLBACK_MS = 680;
const REVEAL_FALLBACK_MS = 760;
const SWIPE_THRESHOLD_PX = 44;

type HeroTransitionPhase = "idle" | "covering" | "revealing";
type AutoplayPauseReason =
  | "hover"
  | "focus"
  | "offscreen"
  | "document-hidden"
  | "manual-hold"
  | "transition"
  | "reduced-motion";

const progressLabels = ["AGILIS", "COLOR", "REFINITY", "eSENSE"];

export function RmCampaignStage() {
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [transitionPhase, setTransitionPhase] =
    useState<HeroTransitionPhase>("idle");
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [documentIsVisible, setDocumentIsVisible] = useState(true);
  const [isHeroAboveViewport, setIsHeroAboveViewport] = useState(false);
  const [pauseReasons, setPauseReasons] = useState<
    ReadonlySet<AutoplayPauseReason>
  >(() => new Set<AutoplayPauseReason>());
  const [autoplayCycle, setAutoplayCycle] = useState(0);
  const activeIndexRef = useRef(0);
  const assetReadinessRef = useRef(new Map<number, Promise<void>>());
  const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const progressFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const pauseReasonsRef = useRef<ReadonlySet<AutoplayPauseReason>>(new Set());
  const documentIsVisibleRef = useRef(true);
  const isHeroAboveViewportRef = useRef(false);
  const pendingIndexRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const progressFillRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const pendingRequestRef = useRef(false);
  const requestTokenRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const transitionFallbackRef = useRef<number | null>(null);
  const transitionPhaseRef = useRef<HeroTransitionPhase>("idle");
  const transitionWasManualRef = useRef(false);
  const manualHoldDelayRef = useRef(0);
  const mountedRef = useRef(true);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    cancelled: boolean;
  } | null>(null);
  const stageRef = useRef<HTMLElement>(null);

  const updatePauseReason = useCallback(
    (reason: AutoplayPauseReason, active: boolean) => {
      const current = pauseReasonsRef.current;
      if (current.has(reason) === active) return;

      const next = new Set(current);
      if (active) next.add(reason);
      else next.delete(reason);
      pauseReasonsRef.current = next;
      setPauseReasons(next);
    },
    [],
  );

  const paintProgress = useCallback((value: number, index: number) => {
    const normalized = Math.min(1, Math.max(0, value));
    progressRef.current = normalized;
    progressFillRefs.current.forEach((fill, fillIndex) => {
      if (!fill) return;
      fill.style.transform = `scaleX(${fillIndex === index ? normalized : 0})`;
    });
    if (stageRef.current) {
      stageRef.current.dataset.progress = String(Math.round(normalized * 100));
    }
  }, []);

  const updateTransitionPhase = useCallback(
    (phase: HeroTransitionPhase) => {
      transitionPhaseRef.current = phase;
      updatePauseReason("transition", phase !== "idle");
      setTransitionPhase(phase);
    },
    [updatePauseReason],
  );

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current === null) return;
    clearTimeout(autoplayTimerRef.current);
    autoplayTimerRef.current = null;
  }, []);

  const clearProgressFrame = useCallback(() => {
    if (progressFrameRef.current === null) return;
    window.cancelAnimationFrame(progressFrameRef.current);
    progressFrameRef.current = null;
  }, []);

  const clearTransitionFallback = useCallback(() => {
    if (transitionFallbackRef.current === null) return;
    window.clearTimeout(transitionFallbackRef.current);
    transitionFallbackRef.current = null;
  }, []);

  const normalizeTransition = useCallback(() => {
    requestTokenRef.current += 1;
    pendingRequestRef.current = false;
    pendingIndexRef.current = null;
    transitionWasManualRef.current = false;
    manualHoldDelayRef.current = 0;
    updatePauseReason("manual-hold", false);
    clearTransitionFallback();
    setPendingIndex(null);
    paintProgress(0, activeIndexRef.current);

    if (transitionPhaseRef.current === "idle") {
      updatePauseReason("transition", false);
      return;
    }

    updateTransitionPhase("idle");
  }, [
    clearTransitionFallback,
    paintProgress,
    updatePauseReason,
    updateTransitionPhase,
  ]);

  const preloadSlide = useCallback((index: number) => {
    const cached = assetReadinessRef.current.get(index);
    if (cached) return cached;

    const slide = rmCampaignSlides[index];
    const assets = [
      window.matchMedia("(max-width: 50rem)").matches
        ? slide.mobileImage
        : slide.desktopImage,
    ];
    const readiness = Promise.all(
      assets.map(
        (src) =>
          new Promise<void>((resolve) => {
            const image = new window.Image();
            let settled = false;
            const finish = () => {
              if (settled) return;
              settled = true;
              window.clearTimeout(fallbackId);
              resolve();
            };
            const fallbackId = window.setTimeout(
              finish,
              IMAGE_PRELOAD_FALLBACK_MS,
            );
            image.onload = finish;
            image.onerror = finish;
            image.src = src;
            if (image.complete) finish();
          }),
      ),
    ).then(() => undefined);

    assetReadinessRef.current.set(index, readiness);
    return readiness;
  }, []);

  const requestSlide = useCallback(
    async (requestedIndex: number, manual = true) => {
      const slideCount = rmCampaignSlides.length;
      const nextIndex = (requestedIndex + slideCount) % slideCount;
      const currentIndex = activeIndexRef.current;
      if (
        nextIndex === currentIndex ||
        transitionPhaseRef.current !== "idle" ||
        pendingRequestRef.current
      ) {
        return;
      }
      if (isHeroAboveViewportRef.current || !documentIsVisibleRef.current) {
        return;
      }

      const nextDirection =
        nextIndex === (currentIndex - 1 + slideCount) % slideCount
          ? "previous"
          : "next";

      const requestToken = requestTokenRef.current + 1;
      requestTokenRef.current = requestToken;
      pendingRequestRef.current = true;
      pendingIndexRef.current = nextIndex;
      transitionWasManualRef.current = manual;
      setDirection(nextDirection);
      setPendingIndex(nextIndex);

      if (manual) {
        manualHoldDelayRef.current = 0;
        updatePauseReason("manual-hold", false);
        paintProgress(0, currentIndex);
      }

      await preloadSlide(nextIndex);
      if (
        !mountedRef.current ||
        requestTokenRef.current !== requestToken ||
        isHeroAboveViewportRef.current ||
        !documentIsVisibleRef.current
      ) {
        return;
      }

      if (reducedMotionRef.current) {
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
        pendingIndexRef.current = null;
        setPendingIndex(null);
        pendingRequestRef.current = false;
        paintProgress(0, nextIndex);
        manualHoldDelayRef.current = manual ? MANUAL_PAUSE_MS : 0;
        updatePauseReason("manual-hold", manual);
        return;
      }

      updateTransitionPhase("covering");
    },
    [
      paintProgress,
      preloadSlide,
      updatePauseReason,
      updateTransitionPhase,
    ],
  );

  const showPrevious = useCallback(
    (manual = true) => requestSlide(activeIndexRef.current - 1, manual),
    [requestSlide],
  );
  const showNext = useCallback(
    (manual = true) => requestSlide(activeIndexRef.current + 1, manual),
    [requestSlide],
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearAutoplayTimer();
      clearProgressFrame();
      if (focusFrameRef.current !== null) {
        window.cancelAnimationFrame(focusFrameRef.current);
      }
      clearTransitionFallback();
    };
  }, [clearAutoplayTimer, clearProgressFrame, clearTransitionFallback]);

  useEffect(() => {
    function syncVisibility() {
      const isHidden = document.visibilityState !== "visible";
      documentIsVisibleRef.current = !isHidden;
      setDocumentIsVisible(!isHidden);
      updatePauseReason("document-hidden", isHidden);

      if (isHidden) {
        clearAutoplayTimer();
        clearProgressFrame();
        normalizeTransition();
        return;
      }

      if (!isHidden) {
        const stage = stageRef.current;
        const hoverCapable = window.matchMedia(
          "(hover: hover) and (pointer: fine)",
        ).matches;
        updatePauseReason(
          "hover",
          Boolean(stage && hoverCapable && stage.matches(":hover")),
        );
      }
    }

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [
    clearAutoplayTimer,
    clearProgressFrame,
    normalizeTransition,
    updatePauseReason,
  ]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateHeroPosition = () => {
      scrollFrameRef.current = null;

      const hero = stageRef.current;
      if (!hero) return;

      const rect = hero.getBoundingClientRect();
      const nextIsAboveViewport = rect.bottom <= 0;
      const wasAboveViewport = isHeroAboveViewportRef.current;
      if (nextIsAboveViewport === wasAboveViewport) return;

      isHeroAboveViewportRef.current = nextIsAboveViewport;
      setIsHeroAboveViewport(nextIsAboveViewport);
      updatePauseReason("offscreen", nextIsAboveViewport);

      if (nextIsAboveViewport) {
        clearAutoplayTimer();
        clearProgressFrame();
        normalizeTransition();
        updatePauseReason("hover", false);
        return;
      }

      normalizeTransition();
      const hoverCapable = window.matchMedia(
        "(hover: hover) and (pointer: fine)",
      ).matches;
      updatePauseReason("hover", hoverCapable && hero.matches(":hover"));
    };

    const requestPositionUpdate = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current = window.requestAnimationFrame(
        updateHeroPosition,
      );
    };

    updateHeroPosition();
    window.addEventListener("scroll", requestPositionUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestPositionUpdate);

    return () => {
      window.removeEventListener("scroll", requestPositionUpdate);
      window.removeEventListener("resize", requestPositionUpdate);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [
    clearAutoplayTimer,
    clearProgressFrame,
    normalizeTransition,
    updatePauseReason,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stage = stageRef.current;
      const activeElement = document.activeElement;
      updatePauseReason(
        "focus",
        Boolean(
          stage &&
            activeElement &&
            stage.contains(activeElement) &&
            activeElement.matches(":focus-visible"),
        ),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, pendingIndex, transitionPhase, updatePauseReason]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    updatePauseReason("reduced-motion", reducedMotion);
  }, [reducedMotion, updatePauseReason]);

  useEffect(() => {
    if (isHeroAboveViewport || !documentIsVisible || reducedMotion) {
      return;
    }

    void preloadSlide(activeIndex);
    void preloadSlide((activeIndex + 1) % rmCampaignSlides.length);

    const preloadRemaining = () => {
      rmCampaignSlides.forEach((_, index) => {
        void preloadSlide(index);
      });
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preloadRemaining);
      return () => window.cancelIdleCallback(idleId);
    }

    return undefined;
  }, [
    activeIndex,
    documentIsVisible,
    isHeroAboveViewport,
    preloadSlide,
    reducedMotion,
  ]);

  const autoplayPaused = pauseReasons.size > 0 || pendingIndex !== null;
  const autoplayState = pauseReasons.has("transition")
    ? "transition"
    : autoplayPaused
      ? "paused"
      : "running";
  const hasBlockingPauseReason = Array.from(pauseReasons).some(
    (reason) => reason !== "manual-hold",
  );
  const shouldAutoplay =
    !isHeroAboveViewport &&
    documentIsVisible &&
    !reducedMotion &&
    rmCampaignSlides.length > 1 &&
    !hasBlockingPauseReason &&
    pendingIndex === null &&
    transitionPhase === "idle";

  useEffect(() => {
    clearAutoplayTimer();
    clearProgressFrame();

    const scheduledIndex = activeIndexRef.current;
    paintProgress(0, scheduledIndex);
    if (!shouldAutoplay) return;

    if (manualHoldDelayRef.current > 0) {
      autoplayTimerRef.current = setTimeout(() => {
        autoplayTimerRef.current = null;
        manualHoldDelayRef.current = 0;
        updatePauseReason("manual-hold", false);
        setAutoplayCycle((current) => current + 1);
      }, manualHoldDelayRef.current);

      return clearAutoplayTimer;
    }

    const startedAt = Date.now();
    const updateProgress = () => {
      if (autoplayTimerRef.current === null) {
        progressFrameRef.current = null;
        return;
      }

      paintProgress(
        (Date.now() - startedAt) / AUTOPLAY_INTERVAL_MS,
        scheduledIndex,
      );

      if (progressRef.current < 1) {
        progressFrameRef.current =
          window.requestAnimationFrame(updateProgress);
      } else {
        progressFrameRef.current = null;
      }
    };

    progressFrameRef.current = window.requestAnimationFrame(updateProgress);
    autoplayTimerRef.current = setTimeout(() => {
      autoplayTimerRef.current = null;
      clearProgressFrame();
      paintProgress(1, scheduledIndex);

      if (
        isHeroAboveViewportRef.current ||
        !documentIsVisibleRef.current ||
        reducedMotionRef.current ||
        pauseReasonsRef.current.size > 0 ||
        transitionPhaseRef.current !== "idle" ||
        pendingIndexRef.current !== null ||
        pendingRequestRef.current ||
        activeIndexRef.current !== scheduledIndex
      ) {
        return;
      }

      void requestSlide(activeIndexRef.current + 1, false);
    }, AUTOPLAY_INTERVAL_MS);

    return () => {
      clearAutoplayTimer();
      clearProgressFrame();
    };
  }, [
    autoplayCycle,
    clearAutoplayTimer,
    clearProgressFrame,
    paintProgress,
    requestSlide,
    shouldAutoplay,
    updatePauseReason,
  ]);

  const completeTransitionPhase = useCallback(
    (phase: Exclude<HeroTransitionPhase, "idle">) => {
      if (transitionPhaseRef.current !== phase) return;

      if (phase === "covering") {
        const nextIndex = pendingIndexRef.current;
        if (nextIndex === null) return;

        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
        paintProgress(0, nextIndex);
        updateTransitionPhase("revealing");
        return;
      }

      const manual = transitionWasManualRef.current;
      manualHoldDelayRef.current = manual ? MANUAL_PAUSE_MS : 0;
      updatePauseReason("manual-hold", manual);
      pendingIndexRef.current = null;
      setPendingIndex(null);
      pendingRequestRef.current = false;
      updateTransitionPhase("idle");
    },
    [paintProgress, updatePauseReason, updateTransitionPhase],
  );

  useEffect(() => {
    clearTransitionFallback();

    if (transitionPhase === "idle") return;

    const phase = transitionPhase;
    transitionFallbackRef.current = window.setTimeout(
      () => completeTransitionPhase(phase),
      phase === "covering" ? COVER_FALLBACK_MS : REVEAL_FALLBACK_MS,
    );

    return () => {
      clearTransitionFallback();
    };
  }, [
    clearTransitionFallback,
    completeTransitionPhase,
    transitionPhase,
  ]);

  function handleWipeAnimationEnd(event: AnimationEvent<HTMLSpanElement>) {
    if (event.target !== event.currentTarget) return;
    if (transitionPhaseRef.current === "idle") return;

    clearTransitionFallback();

    completeTransitionPhase(transitionPhaseRef.current);
  }

  function handlePointerEnter(event: PointerEvent<HTMLElement>) {
    if (
      event.pointerType === "mouse" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
    ) {
      updatePauseReason("hover", true);
    }
  }

  function handlePointerLeave(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") {
      updatePauseReason("hover", false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  }

  function handleFocusCapture(event: FocusEvent<HTMLElement>) {
    const root = event.currentTarget;
    if (focusFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFrameRef.current);
    }
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (!mountedRef.current) return;
      const activeElement = document.activeElement;
      updatePauseReason(
        "focus",
        Boolean(
          activeElement &&
            root.contains(activeElement) &&
            activeElement.matches(":focus-visible"),
        ),
      );
    });
  }

  function handleBlurCapture(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      updatePauseReason("focus", false);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (pointerRef.current || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    pointerRef.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      cancelled: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId || pointer.cancelled) return;

    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 12) {
      pointer.cancelled = true;
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId) return;

    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (
      !pointer.cancelled &&
      Math.abs(deltaX) >= SWIPE_THRESHOLD_PX &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.2
    ) {
      if (deltaX > 0) showPrevious();
      else showNext();
    }

    pointerRef.current = null;
  }

  return (
    <section
      ref={stageRef}
      className={styles.campaignStage}
      aria-label="R-M kampanjski baneri"
      aria-roledescription="carousel"
      data-active-slide={rmCampaignSlides[activeIndex].id}
      data-autoplay-state={autoplayState}
      data-direction={direction}
      data-paused={autoplayPaused || undefined}
      data-pause-reasons={
        pauseReasons.size > 0
          ? Array.from(pauseReasons).sort().join(" ")
          : undefined
      }
      data-pending-slide={
        pendingIndex === null ? undefined : rmCampaignSlides[pendingIndex].id
      }
      data-transition-phase={transitionPhase}
      data-wipe-theme={
        rmCampaignSlides[pendingIndex ?? activeIndex].theme
      }
      onBlurCapture={handleBlurCapture}
      onFocusCapture={handleFocusCapture}
      onKeyDown={handleKeyDown}
      onPointerCancel={() => {
        pointerRef.current = null;
      }}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <nav className={styles.campaignBreadcrumb} aria-label="Putanja">
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">R-M</span>
      </nav>

      <div className={styles.campaignViewport}>
        <div
          className={styles.campaignSlides}
          aria-live="off"
        >
          {rmCampaignSlides.map((slide, index) => (
            <RmCampaignSlide
              active={index === activeIndex}
              index={index}
              key={slide.id}
              slide={slide}
            />
          ))}
        </div>

        <span
          className={styles.campaignWipe}
          aria-hidden="true"
          onAnimationEnd={handleWipeAnimationEnd}
        />

        <div className={styles.campaignControls}>
          <div className={styles.campaignArrows}>
            <button
              type="button"
              aria-label="Prethodni R-M banner"
              disabled={transitionPhase !== "idle" || pendingIndex !== null}
              onClick={() => showPrevious()}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="Sledeći R-M banner"
              disabled={transitionPhase !== "idle" || pendingIndex !== null}
              onClick={() => showNext()}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <div className={styles.campaignPagination} aria-label="Izaberite banner">
            {rmCampaignSlides.map((slide, index) => (
              <button
                type="button"
                aria-label={`Prikaži banner ${index + 1}: ${slide.eyebrow}`}
                aria-current={index === activeIndex ? "true" : undefined}
                aria-pressed={index === activeIndex}
                disabled={transitionPhase !== "idle" || pendingIndex !== null}
                key={slide.id}
                onClick={() => requestSlide(index)}
              >
                <span className={styles.campaignPaginationLabel}>
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <small>{progressLabels[index]}</small>
                </span>
                <span className={styles.campaignPaginationTrack} aria-hidden="true">
                  <i
                    ref={(node) => {
                      progressFillRefs.current[index] = node;
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function RmCampaignSlide({
  active,
  index,
  slide,
}: {
  active: boolean;
  index: number;
  slide: RmCampaignSlideData;
}) {
  return (
    <article
      className={styles.campaignSlide}
      aria-hidden={!active}
      aria-label={`${index + 1} od ${rmCampaignSlides.length}`}
      data-content-align={slide.contentAlign}
      data-active={active || undefined}
      data-theme={slide.theme}
      data-visual-focus={slide.visualFocus}
      style={
        {
          "--rm-image-position-desktop": slide.imagePositionDesktop,
          "--rm-image-position-mobile": slide.imagePositionMobile,
          "--rm-image-scale-desktop": slide.imageScaleDesktop ?? 1,
          "--rm-image-scale-mobile": slide.imageScaleMobile ?? 1,
          "--rm-overlay-strength": slide.overlayStrength,
        } as CSSProperties
      }
    >
      <div className={styles.campaignCopy}>
        <p className={styles.campaignEyebrow}>{slide.eyebrow}</p>
        {active ? <h1>{slide.title}</h1> : <h2>{slide.title}</h2>}
        <p className={styles.campaignDescription}>{slide.description}</p>
        <div className={styles.campaignActions}>
          <Link
            className={styles.rmPrimaryButton}
            href={slide.primaryCta.href}
            tabIndex={active ? 0 : -1}
          >
            <span>{slide.primaryCta.label}</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <Link
            className={styles.rmSecondaryButton}
            href={slide.secondaryCta.href}
            tabIndex={active ? 0 : -1}
          >
            {slide.secondaryCta.label}
          </Link>
        </div>
      </div>

      <RmCampaignVisualArtwork slide={slide} />
    </article>
  );
}

function RmCampaignVisualArtwork({ slide }: { slide: RmCampaignSlideData }) {
  return (
    <div
      className={`${styles.campaignVisual} ${styles.campaignVisualImage}`}
      data-campaign-visual={slide.visual}
      role="img"
      aria-label={slide.imageAlt}
    >
      <picture>
        <source media="(max-width: 50rem)" srcSet={slide.mobileImage} />
        <img
          src={slide.desktopImage}
          alt=""
          width={1600}
          height={900}
          decoding="async"
          fetchPriority={
            slide.id === "agilis-performance" ? "high" : "auto"
          }
          loading={slide.id === "agilis-performance" ? "eager" : "lazy"}
        />
      </picture>
    </div>
  );
}
