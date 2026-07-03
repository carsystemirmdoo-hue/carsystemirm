"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrandEcosystemDesktopCards,
  BrandEcosystemMobileCards,
  BrandPreviewPanel,
  type BrandCatalogPreview,
  type ProgramCategory,
} from "@/components/home/animations/BrandEcosystemCards";
import {
  BrandEcosystemControls,
  BrandEcosystemMobileControls,
} from "@/components/home/animations/BrandEcosystemControls";
import { brandLogos, type BrandKey } from "./BrandLogoPlate";
import {
  getCarsystemProductsByBrandSlug,
} from "@/lib/carsystem-data";
import styles from "./CarsystemHomePage.module.css";

const programCategories: ProgramCategory[] = [
  {
    id: "boje-i-lakovi",
    number: "01",
    title: "Boje i lakovi",
    description:
      "Profesionalni sistemi bojenja, bazne boje, pigmenti i bezbojni lakovi za završni sloj visokog kvaliteta.",
    logos: ["rm", "baslac", "norbin"],
    hints: ["Bazne boje i pigmenti", "Bezbojni lakovi", "Sistemi bojenja", "Razređivači"],
  },
  {
    id: "priprema-i-abrazivi",
    number: "02",
    title: "Priprema i abrazivi",
    description: "Materijali za pripremu površine, gitovanje, prajmere, maskiranje i brušenje.",
    logos: ["carsystem", "carfit", "befar"],
    hints: ["Gitovi", "Prajmeri", "Abrazivi", "Maskiranje"],
  },
  {
    id: "pistolji-i-oprema",
    number: "03",
    title: "Pištolji i oprema",
    description: "Profesionalna oprema, pištolji i pribor za precizan rad u radionici.",
    logos: ["sata", "carsystem", "autofit"],
    hints: ["Pištolji", "Oprema", "Pribor", "Potrošni delovi"],
  },
  {
    id: "poliranje",
    number: "04",
    title: "Poliranje",
    description: "Rešenja za završnu obradu, sjaj, korekciju površine i profesionalno poliranje.",
    logos: ["rupes", "carsystem"],
    hints: ["Polirke", "Paste", "Sunđeri", "Završna obrada"],
  },
  {
    id: "potrosni-materijal",
    number: "05",
    title: "Potrošni materijal",
    description: "Sve što radionici treba za svakodnevni rad, zaštitu, pripremu i završnu obradu.",
    logos: ["carsystem", "cosmosLac", "befar"],
    hints: ["Trake", "Zaštita", "Čaše", "Krpe"],
  },
];

const brandSlugByKey: Partial<Record<BrandKey, string>> = {
  rm: "rm",
  carsystem: "carsystem",
  baslac: "baslac",
  norbin: "norbin",
  sata: "sata",
  carfit: "carfit",
  cosmosLac: "cosmos-spray",
};

function getBrandCatalogPreview(brandKey: BrandKey): BrandCatalogPreview | null {
  const brandSlug = brandSlugByKey[brandKey];
  if (!brandSlug) return null;

  const products = getCarsystemProductsByBrandSlug(brandSlug).slice(0, 3);
  if (products.length === 0) return null;

  return { brandSlug, products };
}

function getBrandKeyBySlug(slug: string) {
  const entry = Object.entries(brandSlugByKey).find(([, brandSlug]) => brandSlug === slug);

  return entry?.[0] as BrandKey | undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function ProgramDeckSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mobileTrackRef = useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = useRef<Array<HTMLElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const mobileRafRef = useRef<number | null>(null);
  const previewCloseTimerRef = useRef<number | null>(null);
  const manualNavigationTimerRef = useRef<number | null>(null);
  const manualTargetIndexRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndexState] = useState(0);
  const [deckProgress, setDeckProgress] = useState(0);
  const [activePreviewBrandSlug, setActivePreviewBrandSlug] = useState<string | null>(null);
  const [previewExiting, setPreviewExiting] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  const setActiveIndex = useCallback((index: number) => {
    const nextIndex = clamp(index, 0, programCategories.length - 1);
    activeIndexRef.current = nextIndex;
    setActiveIndexState(nextIndex);
  }, []);

  const releaseManualNavigation = useCallback(() => {
    manualTargetIndexRef.current = null;

    if (manualNavigationTimerRef.current !== null) {
      window.clearTimeout(manualNavigationTimerRef.current);
      manualNavigationTimerRef.current = null;
    }
  }, []);

  const beginManualNavigation = useCallback(
    (index: number) => {
      releaseManualNavigation();
      manualTargetIndexRef.current = clamp(index, 0, programCategories.length - 1);
      manualNavigationTimerRef.current = window.setTimeout(() => {
        manualNavigationTimerRef.current = null;
        manualTargetIndexRef.current = null;
      }, 950);
    },
    [releaseManualNavigation],
  );

  const clearPreviewCloseTimer = useCallback(() => {
    if (previewCloseTimerRef.current === null) return;
    window.clearTimeout(previewCloseTimerRef.current);
    previewCloseTimerRef.current = null;
  }, []);

  const closePreview = useCallback(() => {
    if (activePreviewBrandSlug === null || previewExiting) return;

    clearPreviewCloseTimer();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setPreviewExiting(false);
      setActivePreviewBrandSlug(null);
      return;
    }

    setPreviewExiting(true);
    previewCloseTimerRef.current = window.setTimeout(() => {
      previewCloseTimerRef.current = null;
      setPreviewExiting(false);
      setActivePreviewBrandSlug(null);
    }, 180);
  }, [activePreviewBrandSlug, clearPreviewCloseTimer, previewExiting]);

  const openBrandPreview = useCallback((brandKey: BrandKey) => {
    const brand = brandLogos[brandKey];
    const preview = getBrandCatalogPreview(brandKey);

    if (!brand.src || !preview) return;

    clearPreviewCloseTimer();
    setPreviewExiting(false);
    setActivePreviewBrandSlug(preview.brandSlug);
  }, [clearPreviewCloseTimer]);

  const canPreviewBrand = useCallback((brandKey: BrandKey) => {
    const brand = brandLogos[brandKey];

    return Boolean(brand.src && getBrandCatalogPreview(brandKey));
  }, []);

  const updateFromScroll = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;

    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    if (rect.bottom < 0 || rect.top > viewportHeight) {
      return;
    }

    const travel = Math.max(1, section.offsetHeight - viewportHeight);
    const progress = clamp(-rect.top / travel, 0, 1);
    const nextIndex = Math.round(progress * (programCategories.length - 1));
    const manualTargetIndex = manualTargetIndexRef.current;

    if (manualTargetIndex !== null) {
      const targetProgress = manualTargetIndex / Math.max(1, programCategories.length - 1);
      setDeckProgress(targetProgress);

      if (Math.abs(progress - targetProgress) < 0.035) {
        releaseManualNavigation();
      }

      return;
    }

    setDeckProgress(progress);

    if (nextIndex !== activeIndexRef.current) {
      setActiveIndex(nextIndex);
      closePreview();
    }
  }, [closePreview, releaseManualNavigation, setActiveIndex]);

  useEffect(() => {
    const media = window.matchMedia(
      "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
    );

    function updateMode() {
      setIsDesktop(media.matches);
    }

    updateMode();
    media.addEventListener("change", updateMode);

    return () => media.removeEventListener("change", updateMode);
  }, []);

  useEffect(() => {
    if (!isDesktop) return undefined;

    function scheduleUpdate() {
      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        updateFromScroll();
      });
    }

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);

      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDesktop, updateFromScroll]);

  useEffect(() => {
    return () => {
      clearPreviewCloseTimer();
      releaseManualNavigation();
    };
  }, [clearPreviewCloseTimer, releaseManualNavigation]);

  useEffect(() => {
    if (activePreviewBrandSlug === null) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePreview();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Element)) {
        closePreview();
        return;
      }

      if (target.closest("[data-brand-preview-region]")) {
        return;
      }

      closePreview();
    }

    function handlePointerMove(event: PointerEvent) {
      if (!isDesktop) return;

      const target = event.target;
      if (target instanceof Element && target.closest("[data-brand-preview-region]")) return;

      closePreview();
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("pointermove", handlePointerMove);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("pointermove", handlePointerMove);
    };
  }, [activePreviewBrandSlug, closePreview, isDesktop]);

  function handleMobileScroll() {
    if (mobileRafRef.current !== null) return;

    mobileRafRef.current = window.requestAnimationFrame(() => {
      mobileRafRef.current = null;
      const track = mobileTrackRef.current;
      if (!track) return;

      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let closestIndex = activeIndexRef.current;
      let closestDistance = Number.POSITIVE_INFINITY;

      mobileCardRefs.current.forEach((card, index) => {
        if (!card) return;
        const cardRect = card.getBoundingClientRect();
        const distance = Math.abs(cardRect.left + cardRect.width / 2 - center);

        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });

      const manualTargetIndex = manualTargetIndexRef.current;
      if (manualTargetIndex !== null) {
        if (closestIndex === manualTargetIndex) {
          releaseManualNavigation();
        }

        return;
      }

      if (closestIndex !== activeIndexRef.current) {
        setActiveIndex(closestIndex);
        setDeckProgress(closestIndex / Math.max(1, programCategories.length - 1));
        closePreview();
      }
    });
  }

  function scrollMobileCardIntoView(index: number) {
    beginManualNavigation(index);
    setActiveIndex(index);
    setDeckProgress(index / Math.max(1, programCategories.length - 1));
    closePreview();
    mobileCardRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  function activateProgramIndex(index: number) {
    beginManualNavigation(index);
    setActiveIndex(index);
    setDeckProgress(index / Math.max(1, programCategories.length - 1));
    closePreview();

    if (!isDesktop || !sectionRef.current) return;

    const section = sectionRef.current;
    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const travel = Math.max(1, section.offsetHeight - viewportHeight);
    const progress = index / Math.max(1, programCategories.length - 1);
    const top = window.scrollY + rect.top + travel * progress;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    window.scrollTo({
      top,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  const activePreviewBrandKey =
    activePreviewBrandSlug === null ? null : getBrandKeyBySlug(activePreviewBrandSlug);
  const activeBrandPreview =
    activePreviewBrandKey === null || activePreviewBrandKey === undefined
      ? null
      : getBrandCatalogPreview(activePreviewBrandKey);

  return (
    <section
      id="brendovi"
      ref={sectionRef}
      className={styles.programDeckSection}
      aria-labelledby="brands-title"
    >
      <div className={styles.programDeckSticky}>
        <div className={styles.programDeckHeader}>
          <div>
            <p className={styles.sectionKicker}>Brend ekosistem</p>
            <h2 id="brands-title">Program za svaki korak refinish procesa.</h2>
            <p>
              Pet programskih celina pokrivaju ceo refinish tok, od sistema bojenja
              do svakodnevnog potrošnog materijala u radionici.
            </p>
          </div>

          <BrandEcosystemControls
            activeIndex={activeIndex}
            categories={programCategories}
            deckProgress={deckProgress}
            onActivate={activateProgramIndex}
          />
        </div>

        <div
          className={styles.programDeckViewport}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget;

            if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
              return;
            }

            closePreview();
          }}
        >
          <div className={styles.programDeckDesktop} aria-label="Program po kategorijama">
            <BrandEcosystemDesktopCards
              activeIndex={activeIndex}
              canPreviewBrand={canPreviewBrand}
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
                canPreviewBrand={canPreviewBrand}
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
              onActivate={scrollMobileCardIntoView}
            />
          </div>

          {activePreviewBrandKey && activeBrandPreview && isDesktop ? (
            <BrandPreviewPanel
              brandKey={activePreviewBrandKey}
              preview={activeBrandPreview}
              onClose={closePreview}
              exiting={previewExiting}
            />
          ) : null}
        </div>
      </div>

      {activePreviewBrandKey && activeBrandPreview && !isDesktop ? (
        <div
          className={styles.programPreviewOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="program-mobile-preview-title"
        >
          <button
            type="button"
            className={styles.programPreviewBackdrop}
            aria-label="Zatvori pregled dodirivanjem pozadine"
            onClick={closePreview}
          />
          <BrandPreviewPanel
            brandKey={activePreviewBrandKey}
            preview={activeBrandPreview}
            onClose={closePreview}
            exiting={previewExiting}
            titleId="program-mobile-preview-title"
            mobile
          />
        </div>
      ) : null}
    </section>
  );
}
