"use client";

import Link from "next/link";
import { useCallback, useRef, type CSSProperties } from "react";
import { useBrandCampaignCarousel } from "@/components/motion/useBrandCampaignCarousel";
import {
  rmCampaignSlides,
  type RmCampaignSlideData,
} from "@/components/rm-brand/rmBrandData";
import styles from "./RmBrandPage.module.css";

const progressLabels = ["AGILIS", "COLOR", "REFINITY", "eSENSE"];

export function RmCampaignStage() {
  const stageRef = useRef<HTMLElement>(null);

  const resolveSlideAssets = useCallback((index: number) => {
    const slide = rmCampaignSlides[index];
    return [
      window.matchMedia("(max-width: 50rem)").matches
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
    slideCount: rmCampaignSlides.length,
    stageRef,
  });

  /*
   * Tranzicija koristi paletu odlazećeg i dolazećeg slajda, ne jednu globalnu
   * brend boju. Palete su statičke iz podataka — bez uzorkovanja slike.
   */
  const incoming = rmCampaignSlides[pendingIndex ?? activeIndex];
  const outgoing =
    transitionPhase === "covering" ? rmCampaignSlides[activeIndex] : incoming;

  return (
    <section
      ref={stageRef}
      className={styles.campaignStage}
      aria-label="R-M kampanjski baneri"
      aria-roledescription="carousel"
      data-active-slide={rmCampaignSlides[activeIndex].id}
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
        pendingIndex === null ? undefined : rmCampaignSlides[pendingIndex].id
      }
      data-transition-phase={transitionPhase}
      style={
        {
          "--campaign-transition-from": outgoing.transitionFrom,
          "--campaign-transition-to": incoming.transitionTo,
          "--campaign-progress-color": rmCampaignSlides[activeIndex].progressColor,
          "--campaign-control-theme": rmCampaignSlides[activeIndex].controlTheme,
        } as CSSProperties
      }
      data-wipe-theme={
        rmCampaignSlides[pendingIndex ?? activeIndex].theme
      }
      {...stageHandlers}
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
              disabled={controlsBusy}
              onClick={() => showPrevious()}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="Sledeći R-M banner"
              disabled={controlsBusy}
              onClick={() => showNext()}
            >
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              aria-label={
                userPaused
                  ? "Pokrenite automatsku promenu R-M bannera"
                  : "Zaustavite automatsku promenu R-M bannera"
              }
              aria-pressed={userPaused}
              data-user-paused={userPaused || undefined}
              onClick={toggleUserPause}
            >
              <span aria-hidden="true">{userPaused ? "▶" : "❚❚"}</span>
            </button>
          </div>

          <div className={styles.campaignPagination} aria-label="Izaberite banner">
            {rmCampaignSlides.map((slide, index) => (
              <button
                type="button"
                aria-label={`Prikažite banner ${index + 1}: ${slide.eyebrow}`}
                aria-current={index === activeIndex ? "true" : undefined}
                aria-pressed={index === activeIndex}
                disabled={controlsBusy}
                key={slide.id}
                onClick={() => requestSlide(index)}
              >
                <span className={styles.campaignPaginationLabel}>
                  <strong>{String(index + 1).padStart(2, "0")}</strong>
                  <small>{progressLabels[index]}</small>
                </span>
                <span className={styles.campaignPaginationTrack} aria-hidden="true">
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
