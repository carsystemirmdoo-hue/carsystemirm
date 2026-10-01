"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
} from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import { CarsystemMediaSlot } from "./CarsystemMediaSlot";
import {
  carsystemHero,
  carsystemHeroSlides,
  carsystemMedia,
  type CarsystemMediaAvailability,
} from "./carsystemBrandData";
import styles from "./CarsystemBrandPage.module.css";

const ROTATION_INTERVAL_MS = 9_500;
const MIN_SWIPE_DISTANCE = 52;

export function CarsystemHero({
  availability,
}: {
  availability: CarsystemMediaAvailability;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [temporarilyPaused, setTemporarilyPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const pointerStartRef = useRef<number | null>(null);
  const activeSlide = carsystemHeroSlides[activeIndex];
  const activeMedia = carsystemMedia[activeSlide.mediaId];
  const rotationPaused =
    reducedMotion || manuallyPaused || temporarilyPaused || !visible;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.12 },
    );
    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (rotationPaused) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % carsystemHeroSlides.length);
    }, ROTATION_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [activeIndex, rotationPaused]);

  function selectSlide(index: number) {
    setActiveIndex(index);
    setManuallyPaused(true);
  }

  function moveSlide(direction: number) {
    setActiveIndex(
      (current) =>
        (current + direction + carsystemHeroSlides.length) %
        carsystemHeroSlides.length,
    );
    setManuallyPaused(true);
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setTemporarilyPaused(false);
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    pointerStartRef.current = event.clientX;
    setTemporarilyPaused(true);
  }

  function handlePointerUp(event: PointerEvent<HTMLElement>) {
    const pointerStart = pointerStartRef.current;
    pointerStartRef.current = null;

    if (pointerStart !== null) {
      const distance = event.clientX - pointerStart;
      if (Math.abs(distance) >= MIN_SWIPE_DISTANCE) {
        moveSlide(distance > 0 ? -1 : 1);
      }
    }

    setTemporarilyPaused(false);
  }

  return (
    <section
      ref={rootRef}
      className={styles.hero}
      aria-labelledby="carsystem-hero-title"
      onBlurCapture={handleBlur}
      onFocusCapture={() => setTemporarilyPaused(true)}
      onMouseEnter={() => setTemporarilyPaused(true)}
      onMouseLeave={() => setTemporarilyPaused(false)}
      onPointerCancel={() => {
        pointerStartRef.current = null;
        setTemporarilyPaused(false);
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <nav className={styles.breadcrumb} aria-label="Putanja stranice">
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <strong>Carsystem</strong>
      </nav>

      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <div className={styles.heroBrand}>
            <span className={styles.heroLogoPlate}>
              <Image
                src="/brands/carsystem.svg"
                alt="Carsystem"
                width={160}
                height={72}
                priority
              />
            </span>
            <span>{carsystemHero.eyebrow}</span>
          </div>

          <div className={styles.heroMessage}>
            <p className={styles.heroSlogan}>{carsystemHero.slogan}</p>
            <h1 id="carsystem-hero-title">{carsystemHero.title}</h1>
            <p>{carsystemHero.description}</p>
          </div>

          <div className={styles.heroActions}>
            <Link className={styles.primaryButton} href={carsystemHero.primaryCta.href}>
              {carsystemHero.primaryCta.label}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link
              className={styles.secondaryButton}
              href={carsystemHero.secondaryCta.href}
            >
              {carsystemHero.secondaryCta.label}
            </Link>
          </div>

          <div
            className={styles.heroActivePhase}
            aria-live={manuallyPaused ? "polite" : "off"}
          >
            <span>{activeSlide.index}</span>
            <div>
              <strong>{activeSlide.label}</strong>
              <p>{activeSlide.detail}</p>
            </div>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <CarsystemMediaSlot
            availability={availability[activeMedia.id]}
            className={styles.heroMedia}
            key={activeMedia.id}
            media={activeMedia}
            priority={activeIndex === 0}
            sizes="(min-width: 80rem) 55vw, (min-width: 48rem) 52vw, 100vw"
          />
          <svg
            className={styles.heroProcessLine}
            viewBox="0 0 720 360"
            aria-hidden="true"
          >
            <path d="M26 305H185c48 0 48-80 96-80h180c54 0 54-110 108-110h125" />
            <circle cx="26" cy="305" r="6" />
            <circle cx="694" cy="115" r="6" />
          </svg>
          <div className={styles.heroVisualMeta} aria-hidden="true">
            <span>WORKFLOW / {activeSlide.index}</span>
            <span>REFINISH SYSTEM</span>
          </div>
        </div>
      </div>

      <div className={styles.heroControls}>
        <div className={styles.heroTabs} aria-label="Izaberite radnu fazu">
          {carsystemHeroSlides.map((slide, index) => (
            <button
              type="button"
              aria-label={`Prikažite fazu: ${slide.label}`}
              aria-pressed={activeIndex === index}
              data-active={activeIndex === index || undefined}
              key={slide.id}
              onClick={() => selectSlide(index)}
            >
              <span>{slide.index}</span>
              <strong>{slide.label}</strong>
            </button>
          ))}
        </div>

        <div className={styles.heroTransport}>
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            aria-label="Prethodna radna faza"
          >
            ←
          </button>
          <span aria-label={`Faza ${activeIndex + 1} od ${carsystemHeroSlides.length}`}>
            {activeIndex + 1} / {carsystemHeroSlides.length}
          </span>
          <button
            type="button"
            onClick={() => moveSlide(1)}
            aria-label="Sledeća radna faza"
          >
            →
          </button>
          {!reducedMotion ? (
            <button
              type="button"
              className={styles.heroPause}
              aria-label={
                manuallyPaused
                  ? "Nastavite automatsku promenu scena"
                  : "Pauzirajte automatsku promenu scena"
              }
              aria-pressed={manuallyPaused}
              onClick={() => setManuallyPaused((current) => !current)}
            >
              {manuallyPaused ? "Pokrenite" : "Pauzirajte"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
