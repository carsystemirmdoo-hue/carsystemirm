"use client";

import Link from "next/link";
import {
  useCallback,
  useRef,
  type CSSProperties,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { useBrandCampaignCarousel } from "@/components/motion/useBrandCampaignCarousel";
import {
  homeCampaignSlides,
  type HomeCampaignSlide,
} from "./homeCampaignData";
import styles from "./HomeCampaignCarousel.module.css";

const MOBILE_MEDIA_QUERY = "(max-width: 53.75rem)";

/*
 * Kartica lokatora je zajednički element hero sekcije: jedna instanca, izvan
 * slajdova, kao apsolutni overlay dole desno preko fotografije. Ne zauzima
 * prostor u rasporedu, pa ne menja širinu slajda ni položaj artworka.
 * Tastatura i pokazivač unutar kartice ne smeju da stignu do stage handlera
 * (strelice i swipe bi menjali slajd dok korisnik bira grad).
 */
function stopStagePropagation(event: SyntheticEvent) {
  event.stopPropagation();
}

export function HomeCampaignCarousel({
  aside,
  headingPresentation = "visible",
}: {
  aside?: ReactNode;
  /**
   * `sr-only` zadržava stabilan H1 za čitače i `aria-labelledby`, ali bez
   * vizuelnog pojasa iznad slajdova. Eksplicitna opcija, podrazumevano
   * vidljiv naslov.
   */
  headingPresentation?: "visible" | "sr-only";
}) {
  const stageRef = useRef<HTMLElement>(null);

  const resolveSlideAssets = useCallback((index: number) => {
    const slide = homeCampaignSlides[index];
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
    slideCount: homeCampaignSlides.length,
    stageRef,
  });

  /*
   * Tranzicija koristi paletu odlazećeg i dolazećeg slajda, ne jednu globalnu
   * brend boju. Palete su statičke iz podataka — bez uzorkovanja slike.
   */
  const incoming = homeCampaignSlides[pendingIndex ?? activeIndex];
  const outgoing =
    transitionPhase === "covering" ? homeCampaignSlides[activeIndex] : incoming;

  /* Jedan h1 element; samo prezentacija (vidljiv omotač ili sr-only) varira. */
  const pageHeading = (
    <h1
      id="homepage-title"
      className={
        headingPresentation === "sr-only" ? "sr-only" : styles.campaignPageTitle
      }
    >
      Profesionalni refinish program za siguran rezultat.
    </h1>
  );

  return (
    <section
      ref={stageRef}
      id="pocetna"
      className={styles.campaignStage}
      aria-labelledby="homepage-title"
      aria-roledescription="carousel"
      data-active-slide={homeCampaignSlides[activeIndex].id}
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
        pendingIndex === null ? undefined : homeCampaignSlides[pendingIndex].id
      }
      data-transition-phase={transitionPhase}
      style={
        {
          "--campaign-transition-from": outgoing.transitionFrom,
          "--campaign-transition-to": incoming.transitionTo,
          "--campaign-progress-color": homeCampaignSlides[activeIndex].progressColor,
          "--campaign-control-theme": homeCampaignSlides[activeIndex].controlTheme,
        } as CSSProperties
      }
      {...stageHandlers}
    >
      {/*
        Stabilan naslov cele pocetne strane.

        Zivi IZVAN `campaignViewport`, pa nikada ne ulazi u slajd sa
        `aria-hidden`. Renderuje se jednom, na serveru, i ne zavisi od aktivnog
        indeksa — autoplay, rucni izbor, tastatura, swipe i Back ga ne diraju.
        Naslovi kampanja su `h2` unutar slajdova.

        Pocetna strana ga trazi kao `sr-only` (identitet je u Header-u uz
        logotip, a vizuelni naslov nose slajdovi), pa iznad slajdova nema
        rezervisanog pojasa.
      */}
      {headingPresentation === "sr-only" ? (
        pageHeading
      ) : (
        <div className={styles.campaignPageHeading}>{pageHeading}</div>
      )}

      <div className={styles.campaignViewport}>
        <div className={styles.campaignSlides} aria-live="off">
          {homeCampaignSlides.map((slide, index) => (
            <HomeCampaignSlide
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
              aria-label="Prethodni banner"
              disabled={controlsBusy}
              onClick={() => showPrevious()}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="Sledeći banner"
              disabled={controlsBusy}
              onClick={() => showNext()}
            >
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              aria-label={
                userPaused
                  ? "Pokrenite automatsku promenu bannera"
                  : "Zaustavite automatsku promenu bannera"
              }
              aria-pressed={userPaused}
              data-user-paused={userPaused || undefined}
              onClick={toggleUserPause}
            >
              <span aria-hidden="true">{userPaused ? "▶" : "❚❚"}</span>
            </button>
          </div>

          <div className={styles.campaignPagination} aria-label="Izaberite banner">
            {homeCampaignSlides.map((slide, index) => (
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

        {aside ? (
          <div
            className={styles.campaignAside}
            onKeyDown={stopStagePropagation}
            onPointerCancel={stopStagePropagation}
            onPointerDown={stopStagePropagation}
            onPointerMove={stopStagePropagation}
            onPointerUp={stopStagePropagation}
          >
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function HomeCampaignSlide({
  active,
  index,
  slide,
}: {
  active: boolean;
  index: number;
  slide: HomeCampaignSlide;
}) {
  return (
    <article
      className={styles.campaignSlide}
      aria-hidden={!active}
      aria-label={`${index + 1} od ${homeCampaignSlides.length}`}
      data-active={active || undefined}
      data-gradient={slide.gradientDirection}
      data-text-theme={slide.textTheme}
      data-visual={slide.visual}
      style={
        {
          "--home-campaign-accent": slide.accentColor,
          "--home-campaign-background": slide.backgroundColor,
          "--home-campaign-focal-desktop": slide.focalPointDesktop,
          "--home-campaign-focal-mobile": slide.focalPointMobile,
          "--home-campaign-ratio": `${slide.imageWidth} / ${slide.imageHeight}`,
        } as CSSProperties
      }
    >
      <HomeCampaignVisual priority={index === 0} slide={slide} />

      <div className={styles.campaignCopy}>
        <p className={styles.campaignEyebrow}>{slide.eyebrow}</p>
        {/* Nivo naslova kampanje ne zavisi od aktivnog slajda — uvek h2. */}
        <h2 className={styles.campaignTitle}>{slide.title}</h2>
        <p className={styles.campaignDescription}>{slide.description}</p>
        <div className={styles.campaignActions}>
          <Link
            className={styles.campaignPrimaryCta}
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

function HomeCampaignVisual({
  priority,
  slide,
}: {
  priority: boolean;
  slide: HomeCampaignSlide;
}) {
  const isArtwork = slide.visual === "artwork";

  return (
    <div
      className={styles.campaignVisual}
      data-visual={slide.visual}
      role="img"
      aria-label={slide.imageAlt}
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
              ? "(max-width: 53.75rem) 68vw, min(32vw, 28rem)"
              : "100vw"
          }
        />
      </picture>
    </div>
  );
}
