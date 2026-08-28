"use client";

import Link from "next/link";
import { useCallback, useRef, type CSSProperties } from "react";
import { useBrandCampaignCarousel } from "@/components/motion/useBrandCampaignCarousel";
import {
  baslacCampaignSlides,
  type BaslacCampaignSlide,
} from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

const MOBILE_MEDIA_QUERY = "(max-width: 50rem)";

export function BaslacHero() {
  const stageRef = useRef<HTMLElement>(null);

  const resolveSlideAssets = useCallback((index: number) => {
    const slide = baslacCampaignSlides[index];
    return [
      window.matchMedia(MOBILE_MEDIA_QUERY).matches
        ? slide.mobileImage
        : slide.desktopImage,
    ];
  }, []);

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
    slideCount: baslacCampaignSlides.length,
    stageRef,
  });

  /*
   * Tranzicija koristi paletu odlazećeg i dolazećeg slajda, ne jednu globalnu
   * brend boju. Palete su statičke iz podataka — bez uzorkovanja slike.
   */
  const incoming = baslacCampaignSlides[pendingIndex ?? activeIndex];
  const outgoing =
    transitionPhase === "covering" ? baslacCampaignSlides[activeIndex] : incoming;

  return (
    <section
      ref={stageRef}
      className={styles.campaignStage}
      aria-label="Baslac kampanjski baneri"
      aria-roledescription="carousel"
      data-active-slide={baslacCampaignSlides[activeIndex].id}
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
        pendingIndex === null
          ? undefined
          : baslacCampaignSlides[pendingIndex].id
      }
      data-transition-phase={transitionPhase}
      style={
        {
          "--campaign-transition-from": outgoing.transitionFrom,
          "--campaign-transition-to": incoming.transitionTo,
          "--campaign-progress-color": baslacCampaignSlides[activeIndex].progressColor,
          "--campaign-control-theme": baslacCampaignSlides[activeIndex].controlTheme,
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
          {baslacCampaignSlides.map((slide, index) => (
            <BaslacCampaignSlide
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
                  ? "Pokreni automatsku promenu Baslac bannera"
                  : "Zaustavi automatsku promenu Baslac bannera"
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
            {baslacCampaignSlides.map((slide, index) => (
              <button
                type="button"
                aria-label={`Prikaži banner ${index + 1}: ${slide.controlLabel}`}
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
}: {
  active: boolean;
  index: number;
  slide: BaslacCampaignSlide;
}) {
  return (
    <article
      className={styles.campaignSlide}
      aria-hidden={!active}
      aria-label={`${index + 1} od ${baslacCampaignSlides.length}`}
      data-active={active || undefined}
      data-visual={slide.visual}
    >
      <BaslacCampaignVisual priority={index === 0} slide={slide} />

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
