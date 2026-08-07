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
import { BaslacMediaSlot } from "./BaslacMediaSlot";
import {
  baslacHeroSlides,
  baslacMedia,
  type BaslacMediaAvailability,
} from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

const ROTATION_INTERVAL = 8_500;
const MIN_SWIPE_DISTANCE = 48;

export function BaslacHero({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = usePrefersReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const pausedRef = useRef(false);
  const visibleRef = useRef(true);
  const elapsedRef = useRef(0);
  const previousFrameRef = useRef<number | null>(null);
  const pointerStartRef = useRef<number | null>(null);
  const activeSlide = baslacHeroSlides[activeIndex];
  const activeMedia = baslacMedia[activeSlide.mediaId];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
        previousFrameRef.current = null;
      },
      { threshold: 0.16 },
    );
    observer.observe(root);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reducedMotion) return;

    let animationFrame = 0;

    const rotate = (time: number) => {
      const previousFrame = previousFrameRef.current;
      previousFrameRef.current = time;

      if (
        previousFrame !== null &&
        !pausedRef.current &&
        visibleRef.current &&
        !document.hidden
      ) {
        elapsedRef.current += Math.min(time - previousFrame, 250);

        if (elapsedRef.current >= ROTATION_INTERVAL) {
          elapsedRef.current %= ROTATION_INTERVAL;
          setActiveIndex(
            (current) => (current + 1) % baslacHeroSlides.length,
          );
        }
      }

      animationFrame = window.requestAnimationFrame(rotate);
    };

    animationFrame = window.requestAnimationFrame(rotate);

    return () => window.cancelAnimationFrame(animationFrame);
  }, [reducedMotion]);

  function resetRotation() {
    elapsedRef.current = 0;
    previousFrameRef.current = null;
  }

  function selectSlide(index: number) {
    resetRotation();
    setActiveIndex(index);
  }

  function moveSlide(direction: number) {
    resetRotation();
    setActiveIndex(
      (current) =>
        (current + direction + baslacHeroSlides.length) %
        baslacHeroSlides.length,
    );
  }

  function pauseRotation() {
    pausedRef.current = true;
    previousFrameRef.current = null;
  }

  function resumeRotation() {
    pausedRef.current = false;
    previousFrameRef.current = null;
  }

  function handleBlur(event: FocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      resumeRotation();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "mouse") return;
    pointerStartRef.current = event.clientX;
    pauseRotation();
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

    resumeRotation();
  }

  return (
    <section
      ref={rootRef}
      className={styles.hero}
      aria-labelledby="baslac-hero-title"
      onFocusCapture={pauseRotation}
      onBlurCapture={handleBlur}
      onMouseEnter={pauseRotation}
      onMouseLeave={resumeRotation}
      onPointerDown={handlePointerDown}
      onPointerCancel={() => {
        pointerStartRef.current = null;
        resumeRotation();
      }}
      onPointerUp={handlePointerUp}
    >
      <nav className={styles.breadcrumb} aria-label="Putanja stranice">
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <strong>baslac</strong>
      </nav>

      <div className={styles.heroStage}>
        <div className={styles.heroCopy}>
          <div className={styles.heroBrand}>
            <span className={styles.heroLogoPlate}>
              <Image
                src="/brands/baslac.svg"
                alt="baslac"
                width={100}
                height={89}
                priority
              />
            </span>
            <p>{activeSlide.eyebrow}</p>
          </div>

          <div className={styles.heroMessage}>
            <span aria-hidden="true">
              {String(activeIndex + 1).padStart(2, "0")}
            </span>
            <h1 id="baslac-hero-title">{activeSlide.title}</h1>
            <p className={styles.heroDescription}>
              {activeSlide.description}
            </p>
          </div>

          <div className={styles.heroActions}>
            <Link
              className={styles.primaryButton}
              href={activeSlide.primaryCta.href}
            >
              {activeSlide.primaryCta.label}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link
              className={styles.secondaryButton}
              href={activeSlide.secondaryCta.href}
            >
              {activeSlide.secondaryCta.label}
            </Link>
          </div>
        </div>

        <BaslacMediaSlot
          availability={availability[activeMedia.id]}
          className={styles.heroMedia}
          media={activeMedia}
          priority={activeIndex === 0}
        />
      </div>

      <div className={styles.heroControls}>
        <div className={styles.heroTabs} aria-label="Izaberite baslac temu">
          {baslacHeroSlides.map((slide, index) => (
            <button
              type="button"
              aria-label={`Prikažite banner: ${slide.controlLabel}`}
              aria-pressed={activeIndex === index}
              data-active={activeIndex === index || undefined}
              key={slide.id}
              onClick={() => selectSlide(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {slide.controlLabel}
            </button>
          ))}
        </div>

        <div className={styles.heroArrows}>
          <button
            type="button"
            onClick={() => moveSlide(-1)}
            aria-label="Prethodni banner"
          >
            ←
          </button>
          <span aria-live="polite" aria-atomic="true">
            {activeIndex + 1} / {baslacHeroSlides.length}
          </span>
          <button
            type="button"
            onClick={() => moveSlide(1)}
            aria-label="Sledeći banner"
          >
            →
          </button>
        </div>
      </div>
    </section>
  );
}
