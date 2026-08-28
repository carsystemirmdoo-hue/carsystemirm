"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import {
  isCampaignFocusInteraction,
  resolveCampaignKeyIntent,
  resolveCampaignSwipeIntent,
  resolveCampaignVisibility,
  shouldCampaignAutoplay,
  shouldCancelCampaignSwipe,
} from "@/components/motion/campaignAutoplayPolicy.mjs";

export const CAMPAIGN_AUTOPLAY_INTERVAL_MS = 7500;
export const CAMPAIGN_MANUAL_PAUSE_MS = 11000;
const IMAGE_PRELOAD_FALLBACK_MS = 2400;
const COVER_FALLBACK_MS = 680;
const REVEAL_FALLBACK_MS = 760;

export type CampaignTransitionPhase = "idle" | "covering" | "revealing";
export type CampaignAutoplayPauseReason =
  | "focus"
  | "offscreen"
  | "document-hidden"
  | "manual-hold"
  | "transition"
  | "reduced-motion"
  | "dragging"
  | "user-paused";

export type BrandCampaignCarouselOptions = {
  /** Broj slajdova u kampanji. */
  slideCount: number;
  /**
   * Vraca URL-ove koje treba ucitati pre nego sto slajd postane aktivan.
   * Poziva se samo u browseru, pa sme da cita `window.matchMedia`.
   */
  resolveSlideAssets: (index: number) => readonly string[];
  /** Element koji definise focus i scroll granice kampanje. */
  stageRef: RefObject<HTMLElement | null>;
  /** Trajanje jednog autoplay ciklusa. */
  autoplayIntervalMs?: number;
  /** Pauza posle rucne promene slajda. */
  manualPauseMs?: number;
};

export type BrandCampaignCarousel = {
  activeIndex: number;
  /** Stanje eksplicitne korisnicke Pause/Play kontrole. */
  userPaused: boolean;
  toggleUserPause: () => void;
  pendingIndex: number | null;
  direction: "next" | "previous";
  transitionPhase: CampaignTransitionPhase;
  autoplayPaused: boolean;
  autoplayState: "running" | "paused" | "transition";
  pauseReasons: ReadonlySet<CampaignAutoplayPauseReason>;
  reducedMotion: boolean;
  /** True dok traje tranzicija — kontrole se tada iskljucuju. */
  controlsBusy: boolean;
  requestSlide: (index: number, manual?: boolean) => void;
  showPrevious: (manual?: boolean) => void;
  showNext: (manual?: boolean) => void;
  registerProgressFill: (index: number) => (node: HTMLElement | null) => void;
  stageHandlers: {
    onBlurCapture: (event: FocusEvent<HTMLElement>) => void;
    onFocusCapture: (event: FocusEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  };
  handleWipeAnimationEnd: (event: AnimationEvent<HTMLElement>) => void;
};

/**
 * Deljeni autoplay/tranzicija state machine za brend kampanjske hero slidere.
 *
 * Ponasanje je 1:1 preuzeto iz R-M kampanjskog heroja: jedan autoplay timeout,
 * progress preko `requestAnimationFrame`, pauza na focus/swipe/skrol i
 * kada je tab sakriven, preload sledeceg slajda pre tranzicije, `prefers-
 * reduced-motion` bez dekorativnog wipe-a, tastatura i swipe.
 */
export function useBrandCampaignCarousel({
  slideCount,
  resolveSlideAssets,
  stageRef,
  autoplayIntervalMs = CAMPAIGN_AUTOPLAY_INTERVAL_MS,
  manualPauseMs = CAMPAIGN_MANUAL_PAUSE_MS,
}: BrandCampaignCarouselOptions): BrandCampaignCarousel {
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [transitionPhase, setTransitionPhase] =
    useState<CampaignTransitionPhase>("idle");
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const [documentIsVisible, setDocumentIsVisible] = useState(true);
  const [sectionIsVisible, setSectionIsVisible] = useState(true);
  const [pauseReasons, setPauseReasons] = useState<
    ReadonlySet<CampaignAutoplayPauseReason>
  >(() => new Set<CampaignAutoplayPauseReason>());
  const [autoplayCycle, setAutoplayCycle] = useState(0);
  const activeIndexRef = useRef(0);
  const assetReadinessRef = useRef(new Map<number, Promise<void>>());
  const autoplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const focusFrameRef = useRef<number | null>(null);
  const pauseReasonsRef = useRef<ReadonlySet<CampaignAutoplayPauseReason>>(
    new Set(),
  );
  const documentIsVisibleRef = useRef(true);
  const sectionIsVisibleRef = useRef(true);
  const pendingIndexRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const progressFillRefs = useRef<Array<HTMLElement | null>>([]);
  const pendingRequestRef = useRef(false);
  const requestTokenRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const transitionFallbackRef = useRef<number | null>(null);
  const transitionPhaseRef = useRef<CampaignTransitionPhase>("idle");
  const transitionWasManualRef = useRef(false);
  const manualHoldDelayRef = useRef(0);
  const mountedRef = useRef(true);
  const pointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    cancelled: boolean;
  } | null>(null);
  const resolveSlideAssetsRef = useRef(resolveSlideAssets);

  useEffect(() => {
    resolveSlideAssetsRef.current = resolveSlideAssets;
  }, [resolveSlideAssets]);

  const updatePauseReason = useCallback(
    (reason: CampaignAutoplayPauseReason, active: boolean) => {
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

  const paintProgress = useCallback(
    (value: number, index: number) => {
      const normalized = Math.min(1, Math.max(0, value));
      progressRef.current = normalized;
      progressFillRefs.current.forEach((fill, fillIndex) => {
        if (!fill) return;
        fill.style.transform = `scaleX(${fillIndex === index ? normalized : 0})`;
      });
      if (stageRef.current) {
        stageRef.current.dataset.progress = String(Math.round(normalized * 100));
      }
    },
    [stageRef],
  );

  const updateTransitionPhase = useCallback(
    (phase: CampaignTransitionPhase) => {
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

    const assets = resolveSlideAssetsRef.current(index);
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
    async (
      requestedIndex: number,
      manual = true,
      directionHint?: "next" | "previous",
    ) => {
      const nextIndex = (requestedIndex + slideCount) % slideCount;
      const currentIndex = activeIndexRef.current;
      if (
        nextIndex === currentIndex ||
        transitionPhaseRef.current !== "idle" ||
        pendingRequestRef.current
      ) {
        return;
      }
      if (!sectionIsVisibleRef.current || !documentIsVisibleRef.current) {
        return;
      }

      /*
       * Kod tacno dva slajda su "sledeci" i "prethodni" isti indeks, pa se
       * smer uzima iz eksplicitnog zahteva kada postoji.
       */
      const nextDirection =
        directionHint ??
        (nextIndex === (currentIndex - 1 + slideCount) % slideCount
          ? "previous"
          : "next");

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
        !sectionIsVisibleRef.current ||
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
        manualHoldDelayRef.current = manual ? manualPauseMs : 0;
        updatePauseReason("manual-hold", manual);
        return;
      }

      updateTransitionPhase("covering");
    },
    [
      manualPauseMs,
      paintProgress,
      preloadSlide,
      slideCount,
      updatePauseReason,
      updateTransitionPhase,
    ],
  );

  const showPrevious = useCallback(
    (manual = true) => {
      void requestSlide(activeIndexRef.current - 1, manual, "previous");
    },
    [requestSlide],
  );
  const showNext = useCallback(
    (manual = true) => {
      void requestSlide(activeIndexRef.current + 1, manual, "next");
    },
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
      }
    }

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () =>
      document.removeEventListener("visibilitychange", syncVisibility);
  }, [
    clearAutoplayTimer,
    clearProgressFrame,
    normalizeTransition,
    updatePauseReason,
  ]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const updateSectionVisibility = () => {
      scrollFrameRef.current = null;

      const section = stageRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const wasVisible = sectionIsVisibleRef.current;
      const nextIsVisible = resolveCampaignVisibility({
        bottom: rect.bottom,
        top: rect.top,
        viewportHeight: window.innerHeight,
        wasVisible,
      });
      if (nextIsVisible === wasVisible) return;

      sectionIsVisibleRef.current = nextIsVisible;
      setSectionIsVisible(nextIsVisible);
      updatePauseReason("offscreen", !nextIsVisible);

      if (!nextIsVisible) {
        clearAutoplayTimer();
        clearProgressFrame();
      }

      // Vraćanje u viewport uredno restartuje tekući interval umesto da
      // nastavi istekli — bez preskakanja dva slajda odjednom.
      normalizeTransition();
    };

    const requestPositionUpdate = () => {
      if (scrollFrameRef.current !== null) return;
      scrollFrameRef.current =
        window.requestAnimationFrame(updateSectionVisibility);
    };

    updateSectionVisibility();
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
    stageRef,
    updatePauseReason,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stage = stageRef.current;
      const activeElement = document.activeElement;
      updatePauseReason(
        "focus",
        isCampaignFocusInteraction({
          activeElement,
          matchesFocusVisible: Boolean(activeElement?.matches(":focus-visible")),
          stage,
        }),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeIndex, pendingIndex, stageRef, transitionPhase, updatePauseReason]);

  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
    updatePauseReason("reduced-motion", reducedMotion);
  }, [reducedMotion, updatePauseReason]);

  useEffect(() => {
    if (!sectionIsVisible || !documentIsVisible || reducedMotion) {
      return;
    }

    void preloadSlide(activeIndex);
    void preloadSlide((activeIndex + 1) % slideCount);

    const preloadRemaining = () => {
      for (let index = 0; index < slideCount; index += 1) {
        void preloadSlide(index);
      }
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preloadRemaining);
      return () => window.cancelIdleCallback(idleId);
    }

    return undefined;
  }, [
    activeIndex,
    documentIsVisible,
    preloadSlide,
    reducedMotion,
    sectionIsVisible,
    slideCount,
  ]);

  const autoplayPaused = pauseReasons.size > 0 || pendingIndex !== null;
  const autoplayState = pauseReasons.has("transition")
    ? "transition"
    : autoplayPaused
      ? "paused"
      : "running";
  const shouldAutoplay = shouldCampaignAutoplay({
    documentIsVisible,
    pauseReasons: Array.from(pauseReasons),
    pendingIndex,
    reducedMotion,
    sectionIsVisible,
    slideCount,
    transitionPhase,
  });

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

      paintProgress((Date.now() - startedAt) / autoplayIntervalMs, scheduledIndex);

      if (progressRef.current < 1) {
        progressFrameRef.current = window.requestAnimationFrame(updateProgress);
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
        !sectionIsVisibleRef.current ||
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

      void requestSlide(activeIndexRef.current + 1, false, "next");
    }, autoplayIntervalMs);

    return () => {
      clearAutoplayTimer();
      clearProgressFrame();
    };
  }, [
    autoplayCycle,
    autoplayIntervalMs,
    clearAutoplayTimer,
    clearProgressFrame,
    paintProgress,
    requestSlide,
    shouldAutoplay,
    updatePauseReason,
  ]);

  const completeTransitionPhase = useCallback(
    (phase: Exclude<CampaignTransitionPhase, "idle">) => {
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
      manualHoldDelayRef.current = manual ? manualPauseMs : 0;
      updatePauseReason("manual-hold", manual);
      pendingIndexRef.current = null;
      setPendingIndex(null);
      pendingRequestRef.current = false;
      updateTransitionPhase("idle");
    },
    [manualPauseMs, paintProgress, updatePauseReason, updateTransitionPhase],
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
  }, [clearTransitionFallback, completeTransitionPhase, transitionPhase]);

  const handleWipeAnimationEnd = useCallback(
    (event: AnimationEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (transitionPhaseRef.current === "idle") return;

      clearTransitionFallback();

      completeTransitionPhase(
        transitionPhaseRef.current as Exclude<CampaignTransitionPhase, "idle">,
      );
    },
    [clearTransitionFallback, completeTransitionPhase],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      // Koji je smer odlucuje `resolveCampaignKeyIntent`; ovde ostaje samo ono
      // sto trazi DOM.
      const intent = resolveCampaignKeyIntent(event);
      if (!intent) return;
      event.preventDefault();
      if (intent === "previous") showPrevious();
      else showNext();
    },
    [showNext, showPrevious],
  );

  const handleFocusCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
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
          isCampaignFocusInteraction({
            activeElement,
            matchesFocusVisible: Boolean(
              activeElement?.matches(":focus-visible"),
            ),
            stage: root,
          }),
        );
      });
    },
    [updatePauseReason],
  );

  const handleBlurCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        updatePauseReason("focus", false);
      }
    },
    [updatePauseReason],
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (
        pointerRef.current ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }

      pointerRef.current = {
        id: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        cancelled: false,
      };
      // Aktivan swipe/drag pauzira autoplay; obican hover ne.
      updatePauseReason("dragging", true);
    },
    [updatePauseReason],
  );

  const handlePointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.id !== event.pointerId || pointer.cancelled) return;

    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (shouldCancelCampaignSwipe({ deltaX, deltaY })) {
      pointer.cancelled = true;
    }
  }, []);

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const pointer = pointerRef.current;
      if (!pointer || pointer.id !== event.pointerId) return;

      const intent = resolveCampaignSwipeIntent({
        deltaX: event.clientX - pointer.startX,
        deltaY: event.clientY - pointer.startY,
        cancelled: pointer.cancelled,
      });
      if (intent === "previous") showPrevious();
      else if (intent === "next") showNext();

      pointerRef.current = null;
      updatePauseReason("dragging", false);
    },
    [showNext, showPrevious, updatePauseReason],
  );

  const handlePointerCancel = useCallback(() => {
    pointerRef.current = null;
    updatePauseReason("dragging", false);
  }, [updatePauseReason]);

  const [userPaused, setUserPaused] = useState(false);
  const toggleUserPause = useCallback(() => {
    setUserPaused((current) => {
      const next = !current;
      updatePauseReason("user-paused", next);
      return next;
    });
  }, [updatePauseReason]);

  const registerProgressFill = useCallback(
    (index: number) => (node: HTMLElement | null) => {
      progressFillRefs.current[index] = node;
    },
    [],
  );

  const requestSlideSync = useCallback(
    (index: number, manual = true) => {
      void requestSlide(index, manual);
    },
    [requestSlide],
  );

  return {
    activeIndex,
    userPaused,
    toggleUserPause,
    pendingIndex,
    direction,
    transitionPhase,
    autoplayPaused,
    autoplayState,
    pauseReasons,
    reducedMotion,
    controlsBusy: transitionPhase !== "idle" || pendingIndex !== null,
    requestSlide: requestSlideSync,
    showPrevious,
    showNext,
    registerProgressFill,
    stageHandlers: {
      onBlurCapture: handleBlurCapture,
      onFocusCapture: handleFocusCapture,
      onKeyDown: handleKeyDown,
      onPointerCancel: handlePointerCancel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
    },
    handleWipeAnimationEnd,
  };
}
