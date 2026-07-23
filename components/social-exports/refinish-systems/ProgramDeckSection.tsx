"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrandEcosystemDesktopCards,
  BrandEcosystemMobileCards,
  BrandPreviewPanel,
} from "@/components/home/animations/BrandEcosystemCards";
import {
  BrandEcosystemControls,
  BrandEcosystemMobileControls,
} from "@/components/home/animations/BrandEcosystemControls";
import type { BrandKey } from "@/components/home/BrandLogoPlate";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import {
  getBrandCatalogPreview,
  getDefaultPreviewBrandKey,
  programCategories,
} from "./refinishSystemsPrograms";
import styles from "@/components/home/CarsystemHomePage.module.css";

/*
 * Sačuvana interaktivna sekcija „Sistemi za ceo refinish tok." — nekadašnji
 * homepage blok, uklonjen sa javne početne stranice ali namerno zadržan kao
 * referentna implementacija (deck kartice, hover/scroll ponašanje, autoplay).
 * Video varijanta za društvene mreže je RefinishSystemsExportStage; ova
 * komponenta trenutno nije rendrovana ni na jednoj javnoj ruti.
 */

const AUTOPLAY_MS = 4400;
const MANUAL_PAUSE_MS = 7000;
const MOBILE_SCROLL_RELEASE_MS = 700;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ProgramDeckSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mobileTrackRef = useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = useRef<Array<HTMLElement | null>>([]);
  const mobileRafRef = useRef<number | null>(null);
  const autoplayTimerRef = useRef<number | null>(null);
  const mobileScrollReleaseTimerRef = useRef<number | null>(null);
  const programmaticMobileScrollRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [activePreviewBrandKey, setActivePreviewBrandKey] = useState<BrandKey | null>(() =>
    getDefaultPreviewBrandKey(programCategories[0]),
  );
  const [isSectionVisible, setIsSectionVisible] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);
  const [usesDesktopDeck, setUsesDesktopDeck] = useState(false);
  const [autoplayPhase, setAutoplayPhase] = useState<"paused" | "running">("running");
  const [autoplayCycle, setAutoplayCycle] = useState(0);

  const clearAutoplayTimer = useCallback(() => {
    if (autoplayTimerRef.current === null) return;
    window.clearTimeout(autoplayTimerRef.current);
    autoplayTimerRef.current = null;
  }, []);

  const showProgram = useCallback((index: number) => {
    const nextIndex = clamp(index, 0, programCategories.length - 1);
    setActiveIndex(nextIndex);
    setActivePreviewBrandKey(getDefaultPreviewBrandKey(programCategories[nextIndex]));
  }, []);

  const pauseAutoRotation = useCallback(() => {
    clearAutoplayTimer();
    pauseUntilRef.current = Date.now() + MANUAL_PAUSE_MS;
    setAutoplayPhase("paused");
    setAutoplayCycle((cycle) => cycle + 1);
  }, [clearAutoplayTimer]);

  const centerMobileCard = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const track = mobileTrackRef.current;
      const card = mobileCardRefs.current[index];
      if (!track || !card) return;

      programmaticMobileScrollRef.current = true;
      if (mobileScrollReleaseTimerRef.current !== null) {
        window.clearTimeout(mobileScrollReleaseTimerRef.current);
      }

      track.scrollTo({
        left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2,
        behavior,
      });

      mobileScrollReleaseTimerRef.current = window.setTimeout(() => {
        programmaticMobileScrollRef.current = false;
        mobileScrollReleaseTimerRef.current = null;
      }, behavior === "smooth" ? MOBILE_SCROLL_RELEASE_MS : 0);
    },
    [],
  );

  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    );

    function updateMode() {
      setUsesDesktopDeck(media.matches);
    }

    updateMode();
    media.addEventListener("change", updateMode);
    return () => media.removeEventListener("change", updateMode);
  }, []);

  useEffect(() => {
    if (usesDesktopDeck) return;
    centerMobileCard(activeIndex, prefersReducedMotion ? "auto" : "smooth");
  }, [activeIndex, centerMobileCard, prefersReducedMotion, usesDesktopDeck]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || !("IntersectionObserver" in window)) {
      setIsSectionVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = Boolean(entry?.isIntersecting);
        if (!isVisible) clearAutoplayTimer();
        setIsSectionVisible(isVisible);
        if (isVisible) setAutoplayCycle((cycle) => cycle + 1);
      },
      { rootMargin: "-12% 0px", threshold: 0.16 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [clearAutoplayTimer]);

  useEffect(() => {
    clearAutoplayTimer();
    if (prefersReducedMotion || !isSectionVisible || !isPageVisible) return undefined;

    const remainingPause = Math.max(0, pauseUntilRef.current - Date.now());
    const delay = autoplayPhase === "paused" ? remainingPause : AUTOPLAY_MS;

    autoplayTimerRef.current = window.setTimeout(() => {
      autoplayTimerRef.current = null;

      if (autoplayPhase === "paused") {
        pauseUntilRef.current = 0;
        setAutoplayPhase("running");
        setAutoplayCycle((cycle) => cycle + 1);
        return;
      }

      const nextIndex = (activeIndex + 1) % programCategories.length;
      showProgram(nextIndex);
      setAutoplayCycle((cycle) => cycle + 1);
    }, delay);

    return clearAutoplayTimer;
  }, [
    activeIndex,
    autoplayPhase,
    clearAutoplayTimer,
    isPageVisible,
    isSectionVisible,
    prefersReducedMotion,
    showProgram,
  ]);

  useEffect(() => {
    function handleVisibilityChange() {
      const isVisible = !document.hidden;
      if (!isVisible) clearAutoplayTimer();
      setIsPageVisible(isVisible);
      if (isVisible) setAutoplayCycle((cycle) => cycle + 1);
    }

    setIsPageVisible(!document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [clearAutoplayTimer]);

  useEffect(() => {
    return () => {
      if (mobileRafRef.current !== null) window.cancelAnimationFrame(mobileRafRef.current);
      if (mobileScrollReleaseTimerRef.current !== null) {
        window.clearTimeout(mobileScrollReleaseTimerRef.current);
      }
      clearAutoplayTimer();
    };
  }, [clearAutoplayTimer]);

  const openBrandPreview = useCallback(
    (brandKey: BrandKey) => {
      pauseAutoRotation();
      setActivePreviewBrandKey(brandKey);
    },
    [pauseAutoRotation],
  );

  function handleMobileScroll() {
    if (programmaticMobileScrollRef.current || mobileRafRef.current !== null) return;

    mobileRafRef.current = window.requestAnimationFrame(() => {
      mobileRafRef.current = null;
      const track = mobileTrackRef.current;
      if (!track) return;

      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let closestIndex = activeIndex;
      let closestDistance = Number.POSITIVE_INFINITY;

      mobileCardRefs.current.forEach((card, index) => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const distance = Math.abs(cardRect.left + cardRect.width / 2 - center);
        if (distance >= closestDistance) return;
        closestDistance = distance;
        closestIndex = index;
      });

      if (closestIndex !== activeIndex) {
        pauseAutoRotation();
        showProgram(closestIndex);
      }
    });
  }

  function activateProgramIndex(index: number) {
    pauseAutoRotation();
    showProgram(index);
  }

  const activeBrandPreview = activePreviewBrandKey
    ? getBrandCatalogPreview(activePreviewBrandKey, programCategories[activeIndex])
    : null;
  const isAutoplayRunning =
    autoplayPhase === "running" &&
    isSectionVisible &&
    isPageVisible &&
    !prefersReducedMotion;

  return (
    <section
      id="brendovi"
      ref={sectionRef}
      className={`${styles.programDeckSection} ${styles.programDeckLiveSection} ${styles.railTarget}`}
      aria-labelledby="brands-title"
    >
      <div className={`${styles.programDeckSticky} ${styles.programDeckLiveSticky}`}>
        <div className={styles.programDeckHeader}>
          <div>
            <p className={styles.sectionKicker}>Program proizvoda</p>
            <h2 id="brands-title">Sistemi za ceo refinish tok.</h2>
            <p>
              Pet programskih celina povezuje boje, pripremu, opremu, poliranje
              i potrošni materijal u pregledan katalog za radionice.
            </p>
          </div>

          <BrandEcosystemControls
            activeIndex={activeIndex}
            autoplayMs={AUTOPLAY_MS}
            categories={programCategories}
            isAutoplayRunning={isAutoplayRunning}
            onActivate={activateProgramIndex}
            progressCycle={autoplayCycle}
          />
        </div>

        <div className={`${styles.programDeckViewport} ${styles.programDeckLiveViewport}`}>
          <div className={styles.programDeckDesktop} aria-label="Program po kategorijama">
            <BrandEcosystemDesktopCards
              activeIndex={activeIndex}
              activePreviewBrandKey={activePreviewBrandKey}
              categories={programCategories}
              onBrandPreview={openBrandPreview}
            />
          </div>

          <div className={styles.programMobileShell}>
            <div
              ref={mobileTrackRef}
              className={styles.programMobileTrack}
              onScroll={handleMobileScroll}
              aria-label="Program po kategorijama"
            >
              <BrandEcosystemMobileCards
                activeIndex={activeIndex}
                activePreviewBrandKey={activePreviewBrandKey}
                categories={programCategories}
                onBrandPreview={openBrandPreview}
                setCardRef={(index, node) => {
                  mobileCardRefs.current[index] = node;
                }}
              />
            </div>

            <BrandEcosystemMobileControls
              activeIndex={activeIndex}
              categories={programCategories}
              onActivate={activateProgramIndex}
            />
          </div>

          {activePreviewBrandKey && activeBrandPreview ? (
            <BrandPreviewPanel
              key={`${activeIndex}-${activePreviewBrandKey}`}
              brandKey={activePreviewBrandKey}
              preview={activeBrandPreview}
              titleId="program-live-preview-title"
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}
