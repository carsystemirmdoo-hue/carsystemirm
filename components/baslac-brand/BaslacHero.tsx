"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import { useBrandCampaignCarousel } from "@/components/motion/useBrandCampaignCarousel";
import { useSeasonalCampaign } from "@/components/seasonal/useSeasonalCampaign";
import {
  baslacCampaignSlides,
  type BaslacCampaignSlide,
  type BaslacHeroSlide,
  type BaslacSeasonalSlide,
} from "./baslacBrandData";
import { withBaslacSeasonalSlide } from "./baslacSeasonal";
import styles from "./BaslacBrandPage.module.css";

const MOBILE_MEDIA_QUERY = "(max-width: 50rem)";

export function BaslacHero() {
  const stageRef = useRef<HTMLElement>(null);
  /*
   * Sezona se određuje tek posle hidratacije (vidi `useSeasonalCampaign`).
   * Standardni slajdovi i njihov redosled ostaju isti; sezonski se samo umeće
   * iza prvog, pa aktivni slajd, h1 i LCP slika ne menjaju mesto.
   */
  const seasonal = useSeasonalCampaign();
  const slides = useMemo(
    () => withBaslacSeasonalSlide(baslacCampaignSlides, seasonal),
    [seasonal],
  );

  const resolveSlideAssets = useCallback(
    (index: number) => {
      const slide = slides[index];
      if (!slide) return [];
      const mobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
      if (slide.visual === "seasonal") {
        if (!slide.image) return [];
        return [mobile ? slide.image.mobileSrc : slide.image.desktopSrc];
      }
      return [mobile ? slide.mobileImage : slide.desktopImage];
    },
    [slides],
  );

  const {
    activeIndex,
    autoplayPaused,
    autoplayState,
    controlsBusy,
    direction,
    handleWipeAnimationEnd,
    pauseReasons,
    pendingIndex,
    registerProgressFill,
    requestSlide,
    showNext,
    showPrevious,
    stageHandlers,
    toggleUserPause,
    transitionPhase,
    userPaused,
  } = useBrandCampaignCarousel({
    resolveSlideAssets,
    slideCount: slides.length,
    stageRef,
  });

  /*
   * Tranzicija koristi paletu odlazećeg i dolazećeg slajda, ne jednu globalnu
   * brend boju. Palete su statičke iz podataka — bez uzorkovanja slike.
   */
  const incoming = slides[pendingIndex ?? activeIndex] ?? slides[0];
  const outgoing =
    transitionPhase === "covering" ? (slides[activeIndex] ?? incoming) : incoming;
  const activeSlide = slides[activeIndex] ?? slides[0];

  return (
    <section
      ref={stageRef}
      className={styles.campaignStage}
      aria-label="Baslac kampanjski baneri"
      aria-roledescription="carousel"
      data-active-slide={activeSlide.id}
      data-active-index={activeIndex}
      data-autoplay-state={autoplayState}
      data-direction={direction}
      data-paused={autoplayPaused || undefined}
      data-pause-reason={
        pauseReasons.size > 0
          ? Array.from(pauseReasons).sort().join(" ")
          : "none"
      }
      data-pause-reasons={
        pauseReasons.size > 0
          ? Array.from(pauseReasons).sort().join(" ")
          : undefined
      }
      data-pending-slide={
        pendingIndex === null ? undefined : slides[pendingIndex]?.id
      }
      data-seasonal-campaign={seasonal?.campaign.id}
      data-transition-phase={transitionPhase}
      style={
        {
          "--campaign-transition-from": outgoing.transitionFrom,
          "--campaign-transition-to": incoming.transitionTo,
          "--campaign-progress-color": activeSlide.progressColor,
          "--campaign-control-theme": activeSlide.controlTheme,
        } as CSSProperties
      }
      {...stageHandlers}
    >
      <nav
        className={`${styles.breadcrumb} ${styles.campaignBreadcrumb}`}
        aria-label="Putanja stranice"
      >
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">Baslac</strong>
      </nav>

      <div className={styles.campaignViewport}>
        <div className={styles.campaignSlides} aria-live="off">
          {slides.map((slide, index) => (
            <BaslacCampaignSlide
              active={index === activeIndex}
              index={index}
              key={slide.id}
              slide={slide}
              total={slides.length}
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
              aria-label="Prethodni Baslac banner"
              disabled={controlsBusy}
              onClick={() => showPrevious()}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="Sledeći Baslac banner"
              disabled={controlsBusy}
              onClick={() => showNext()}
            >
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              aria-label={
                userPaused
                  ? "Pokrenite automatsku promenu Baslac bannera"
                  : "Zaustavite automatsku promenu Baslac bannera"
              }
              aria-pressed={userPaused}
              data-user-paused={userPaused || undefined}
              onClick={toggleUserPause}
            >
              <span aria-hidden="true">{userPaused ? "▶" : "❚❚"}</span>
            </button>
          </div>

          <div
            className={styles.campaignPagination}
            aria-label="Izaberite banner"
          >
            {slides.map((slide, index) => (
              <button
                type="button"
                aria-label={`Prikažite banner ${index + 1}: ${slide.controlLabel}`}
                aria-current={index === activeIndex ? "true" : undefined}
                aria-pressed={index === activeIndex}
                disabled={controlsBusy}
                key={slide.id}
                onClick={() => requestSlide(index)}
              >
                <span className={styles.campaignPaginationLabel}>
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <small>{slide.controlLabel}</small>
                </span>
                <span
                  className={styles.campaignPaginationTrack}
                  aria-hidden="true"
                >
                  <i ref={registerProgressFill(index)} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BaslacCampaignSlide({
  active,
  index,
  slide,
  total,
}: {
  active: boolean;
  index: number;
  slide: BaslacHeroSlide;
  total: number;
}) {
  return (
    <article
      className={styles.campaignSlide}
      aria-hidden={!active}
      aria-label={`${index + 1} od ${total}`}
      data-active={active || undefined}
      data-visual={slide.visual}
      data-season={slide.visual === "seasonal" ? slide.season : undefined}
    >
      {slide.visual === "seasonal" ? (
        <BaslacSeasonalVisual slide={slide} />
      ) : (
        <BaslacCampaignVisual priority={index === 0} slide={slide} />
      )}

      <div className={styles.campaignCopy}>
        <p className={styles.campaignEyebrow}>{slide.eyebrow}</p>
        {active ? (
          <h1 id="baslac-hero-title" className={styles.campaignTitle}>
            {slide.title}
          </h1>
        ) : (
          <h2 className={styles.campaignTitle}>{slide.title}</h2>
        )}
        <p className={styles.campaignDescription}>{slide.description}</p>
        <div className={styles.campaignActions}>
          <Link
            className={styles.primaryButton}
            href={slide.primaryCta.href}
            tabIndex={active ? 0 : -1}
          >
            {slide.primaryCta.label}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </article>
  );
}

function BaslacCampaignVisual({
  priority,
  slide,
}: {
  priority: boolean;
  slide: BaslacCampaignSlide;
}) {
  const isArtwork = slide.visual === "artwork";

  return (
    <div
      className={styles.campaignVisual}
      data-visual={slide.visual}
      role="img"
      aria-label={slide.imageAlt}
      style={
        {
          "--baslac-campaign-ratio": `${slide.imageWidth} / ${slide.imageHeight}`,
          "--baslac-campaign-mobile-ratio": `${slide.mobileImageWidth} / ${slide.mobileImageHeight}`,
        } as CSSProperties
      }
    >
      <picture>
        {slide.mobileImage === slide.desktopImage ? null : (
          <source media={MOBILE_MEDIA_QUERY} srcSet={slide.mobileImage} />
        )}
        <img
          src={slide.desktopImage}
          alt=""
          width={slide.imageWidth}
          height={slide.imageHeight}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          loading={priority ? "eager" : "lazy"}
          sizes={
            isArtwork
              ? "(max-width: 50rem) 62vw, min(30vw, 26rem)"
              : "(max-width: 50rem) 100vw, 100vw"
          }
        />
      </picture>
    </div>
  );
}

/**
 * Sezonski vizual. Bez odobrene slike (ili ako slika ne uspe da se učita)
 * ostaje samo CSS dekoracija iz `data-season`, pa slajd nikad ne prikaže
 * polomljenu sliku. Slika je uvek lazy — nikad nije LCP kandidat.
 */
function BaslacSeasonalVisual({ slide }: { slide: BaslacSeasonalSlide }) {
  const [failed, setFailed] = useState(false);
  const image = failed ? null : slide.image;

  return (
    <div
      className={styles.campaignVisual}
      data-visual="seasonal"
      data-season={slide.season}
      data-has-image={image ? true : undefined}
      role="img"
      aria-label={slide.imageAlt}
    >
      {image ? (
        <picture>
          {image.mobileSrc === image.desktopSrc ? null : (
            <source media={MOBILE_MEDIA_QUERY} srcSet={image.mobileSrc} />
          )}
          <img
            src={image.desktopSrc}
            alt=""
            width={image.width}
            height={image.height}
            decoding="async"
            loading="lazy"
            sizes="(max-width: 50rem) 80vw, 30rem"
            onError={() => setFailed(true)}
          />
        </picture>
      ) : null}
    </div>
  );
}
