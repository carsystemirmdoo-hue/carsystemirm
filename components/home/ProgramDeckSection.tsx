"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BrandLogoPlate, brandLogos, type BrandKey } from "./BrandLogoPlate";
import {
  getCarsystemProductsByBrandSlug,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import styles from "./CarsystemHomePage.module.css";

type ProgramCategory = {
  id: string;
  number: string;
  title: string;
  description: string;
  logos: BrandKey[];
  hints: string[];
};

type BrandCatalogPreview = {
  brandSlug: string;
  products: CarsystemProduct[];
};

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

function getCircularPosition(index: number, activeIndex: number) {
  const count = programCategories.length;
  const raw = (index - activeIndex + count) % count;
  return raw > count / 2 ? raw - count : raw;
}

function getPositionClass(position: number) {
  if (position === 0) return styles.programDeckCardActive;
  if (position === -1) return styles.programDeckCardPrevious;
  if (position === 1) return styles.programDeckCardNext;
  if (position === -2) return styles.programDeckCardFarPrevious;
  return styles.programDeckCardFarNext;
}

export function ProgramDeckSection() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const mobileTrackRef = useRef<HTMLDivElement | null>(null);
  const mobileCardRefs = useRef<Array<HTMLElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const mobileRafRef = useRef<number | null>(null);
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndexState] = useState(0);
  const [activePreviewBrandSlug, setActivePreviewBrandSlug] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const setActiveIndex = useCallback((index: number) => {
    const nextIndex = clamp(index, 0, programCategories.length - 1);
    activeIndexRef.current = nextIndex;
    setActiveIndexState(nextIndex);
  }, []);

  const closePreview = useCallback(() => {
    setActivePreviewBrandSlug(null);
  }, []);

  const openBrandPreview = useCallback((brandKey: BrandKey) => {
    const brand = brandLogos[brandKey];
    const preview = getBrandCatalogPreview(brandKey);

    if (!brand.src || !preview) return;

    setActivePreviewBrandSlug(preview.brandSlug);
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

    if (nextIndex !== activeIndexRef.current) {
      setActiveIndex(nextIndex);
      setActivePreviewBrandSlug(null);
    }
  }, [setActiveIndex]);

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

      if (closestIndex !== activeIndexRef.current) {
        setActiveIndex(closestIndex);
        setActivePreviewBrandSlug(null);
      }
    });
  }

  function scrollMobileCardIntoView(index: number) {
    setActiveIndex(index);
    setActivePreviewBrandSlug(null);
    mobileCardRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  function activateProgramIndex(index: number) {
    setActiveIndex(index);
    setActivePreviewBrandSlug(null);

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

          <div className={styles.programDeckProgress} aria-label="Izaberi programsku celinu">
            <span>{programCategories[activeIndex].number}</span>
            <div>
              {programCategories.map((category, index) => (
                <button
                  type="button"
                  key={category.id}
                  className={index === activeIndex ? styles.programDeckProgressActive : ""}
                  aria-label={`Idi na korak ${index + 1}: ${category.title}`}
                  aria-pressed={index === activeIndex}
                  data-cursor="button"
                  onClick={() => activateProgramIndex(index)}
                />
              ))}
            </div>
          </div>
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
            {programCategories.map((category, index) => {
              const position = getCircularPosition(index, activeIndex);
              const isActive = position === 0;

              return (
                <ProgramCard
                  key={category.id}
                  category={category}
                  className={getPositionClass(position)}
                  isActive={isActive}
                  onBrandPreview={openBrandPreview}
                />
              );
            })}
          </div>

          <div className={styles.programMobileShell}>
            <div
              ref={mobileTrackRef}
              className={styles.programMobileTrack}
              onScroll={handleMobileScroll}
              aria-label="Program po kategorijama"
            >
              {programCategories.map((category, index) => (
                <ProgramCard
                  key={category.id}
                  category={category}
                  className={index === activeIndex ? styles.programMobileCardActive : ""}
                  isActive={index === activeIndex}
                  onBrandPreview={openBrandPreview}
                  setRef={(node) => {
                    mobileCardRefs.current[index] = node;
                  }}
                />
              ))}
            </div>

            <div className={styles.programMobileControls} aria-label="Izaberi program">
              {programCategories.map((category, index) => (
                <button
                  type="button"
                  key={category.id}
                  className={index === activeIndex ? styles.programMobileDotActive : ""}
                  onClick={() => scrollMobileCardIntoView(index)}
                  aria-label={`Prikaži ${category.title}`}
                  aria-pressed={index === activeIndex}
                />
              ))}
            </div>
          </div>

          {activePreviewBrandKey && activeBrandPreview && isDesktop ? (
            <BrandPreviewPanel
              brandKey={activePreviewBrandKey}
              preview={activeBrandPreview}
              onClose={closePreview}
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
            titleId="program-mobile-preview-title"
            mobile
          />
        </div>
      ) : null}
    </section>
  );
}

function ProgramCard({
  category,
  className,
  isActive,
  onBrandPreview,
  setRef,
}: {
  category: ProgramCategory;
  className: string;
  isActive: boolean;
  onBrandPreview: (brandKey: BrandKey) => void;
  setRef?: (node: HTMLElement | null) => void;
}) {
  return (
    <article
      ref={setRef}
      data-brand-preview-region={isActive ? "card" : undefined}
      className={`${styles.programDeckCard} ${className}`}
      aria-current={isActive ? "step" : undefined}
    >
      <div className={styles.programCardInner}>
        <div className={styles.programCardTop}>
          <span className={styles.programNumber}>{category.number}</span>
          <span className={styles.programCardLabel}>Program</span>
        </div>

        <div className={styles.programCardBody}>
          <h3>{category.title}</h3>
          <p>{category.description}</p>
        </div>

        <div className={styles.programLogoGrid} aria-label={`Brendovi za ${category.title}`}>
          {category.logos.map((brandKey) => (
            <ProgramBrandLogo
              key={brandKey}
              brandKey={brandKey}
              isActive={isActive}
              onBrandPreview={onBrandPreview}
            />
          ))}
        </div>

        <div className={styles.programHints} aria-label="Program obuhvata">
          {category.hints.map((hint) => (
            <span key={hint}>{hint}</span>
          ))}
        </div>

        <a
          className={styles.programPreviewButton}
          href={`/program/${category.id}`}
          tabIndex={isActive ? 0 : -1}
        >
          Pogledaj program
        </a>
      </div>
    </article>
  );
}

function ProgramBrandLogo({
  brandKey,
  isActive,
  onBrandPreview,
}: {
  brandKey: BrandKey;
  isActive: boolean;
  onBrandPreview: (brandKey: BrandKey) => void;
}) {
  const brand = brandLogos[brandKey];
  const canPreview = Boolean(brand.src && getBrandCatalogPreview(brandKey));

  if (!canPreview) {
    return <BrandLogoPlate brandKey={brandKey} />;
  }

  return (
    <button
      type="button"
      className={styles.programBrandLogoButton}
      disabled={!isActive}
      tabIndex={isActive ? 0 : -1}
      aria-haspopup="dialog"
      aria-label={`Pregled kataloga brenda ${brand.name}`}
      onMouseEnter={() => {
        if (isActive) onBrandPreview(brandKey);
      }}
      onPointerEnter={(event) => {
        if (isActive && event.pointerType !== "touch") onBrandPreview(brandKey);
      }}
      onFocus={() => {
        if (isActive) onBrandPreview(brandKey);
      }}
      onClick={(event) => {
        event.stopPropagation();
        if (isActive) onBrandPreview(brandKey);
      }}
    >
      <BrandLogoPlate brandKey={brandKey} />
    </button>
  );
}

function BrandPreviewPanel({
  brandKey,
  preview,
  onClose,
  titleId = "brand-preview-title",
  mobile = false,
}: {
  brandKey: BrandKey;
  preview: BrandCatalogPreview;
  onClose: () => void;
  titleId?: string;
  mobile?: boolean;
}) {
  const brand = brandLogos[brandKey];
  const brandHref = `/brendovi/${preview.brandSlug}`;

  return (
    <div
      data-brand-preview-region="panel"
      role={mobile ? undefined : "dialog"}
      aria-modal={mobile ? undefined : false}
      aria-labelledby={titleId}
      className={`${styles.programPreviewPanel} ${mobile ? styles.programPreviewPanelMobile : ""}`}
    >
      <div className={styles.programPreviewTop}>
        <span>Pregled kataloga</span>
        <button type="button" onClick={onClose} aria-label="Zatvori pregled kataloga brenda">
          ×
        </button>
      </div>

      <div className={styles.programPreviewBody}>
        <div className={styles.programPreviewBrand}>
          <BrandLogoPlate brandKey={brandKey} />
          <div>
            <small>Brend program</small>
            <strong>{brand.name}</strong>
          </div>
        </div>

        <h3 id={titleId}>Pregled kataloga</h3>
        <span>Proizvodi iz {brand.name} programa</span>

        <div className={styles.programPreviewGrid}>
          {preview.products.map((product) => (
            <Link href={`/proizvodi/${product.slug}`} key={product.slug}>
              <span className={styles.programPreviewThumb}>
                {product.productImage ? (
                  <Image
                    src={product.productImage.src}
                    alt={product.productImage.alt}
                    width={96}
                    height={72}
                  />
                ) : (
                  <span className={styles.programPreviewPlaceholder}>Slika u pripremi</span>
                )}
              </span>
              <small>{product.badges[0] ?? product.sku}</small>
              <strong>{product.name}</strong>
            </Link>
          ))}
        </div>

        <Link className={styles.programPreviewCta} href={brandHref}>
          Pogledaj katalog brenda
        </Link>
      </div>
    </div>
  );
}
