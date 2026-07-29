"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { HybridPaintTakeoverArtwork } from "@/components/paint-takeover/HybridPaintTakeoverArtwork";
import { TAKEOVER_SURFACE_PATH } from "@/components/paint-takeover/paintTakeoverMotionConfig";
import type {
  FinalHeroManifest,
  PaintTakeoverRuntimeSnapshot,
} from "@/components/paint-takeover/paintTakeoverTypes";
import { usePaintTakeoverMotion } from "@/components/paint-takeover/usePaintTakeoverMotion";
import { PaintTakeoverDebugPanel } from "./PaintTakeoverDebugPanel";
import styles from "./PaintTakeoverHomeSection.module.css";

type PaintTakeoverHomeSectionProps = {
  debugEnabled?: boolean;
  heroArtwork: string;
  manifest: FinalHeroManifest;
  washDisabled?: boolean;
};

export function PaintTakeoverHomeSection({
  debugEnabled = false,
  heroArtwork,
  manifest,
  washDisabled = false,
}: PaintTakeoverHomeSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const heroArtworkRef = useRef<HTMLDivElement>(null);
  const [runtimeSnapshot, setRuntimeSnapshot] =
    useState<PaintTakeoverRuntimeSnapshot | null>(null);

  const handleRuntimeSnapshot = useCallback(
    (snapshot: PaintTakeoverRuntimeSnapshot) => {
      setRuntimeSnapshot(snapshot);
    },
    [],
  );

  usePaintTakeoverMotion({
    sectionRef,
    heroArtworkRef,
    manifest,
    debug: debugEnabled,
    onRuntimeSnapshot: debugEnabled
      ? handleRuntimeSnapshot
      : undefined,
    controlPageChrome: !washDisabled,
    washDisabled,
  });

  return (
    <section
      ref={sectionRef}
      id="paint-takeover"
      className={styles.section}
      data-paint-debug-layout={debugEnabled ? "true" : undefined}
      data-wash-disabled={washDisabled ? "true" : undefined}
      aria-labelledby="paint-takeover-home-title"
    >
      <div className={styles.stickyViewport}>
        <div className={styles.takeoverSurface} aria-hidden="true">
          <svg
            focusable="false"
            preserveAspectRatio="none"
            viewBox="0 0 1920 1420"
          >
            <defs>
              {/*
                Meka ivica prelaza. Ranije je ovo bio jedan hard-edge path koji
                je klizio nagore — čitao se kao geometrijski wipe / border.
                Sada ispod oštre ivice ide zamućena kopija koja "procuri" u
                svetlu površinu, pa prelaz deluje kao boja koja preuzima
                podlogu, a ne kao rez.
              */}
              <filter
                id="home-paint-surface-feather"
                x="-10%"
                y="-30%"
                width="120%"
                height="160%"
              >
                <feGaussianBlur stdDeviation="26" />
              </filter>
              <radialGradient
                id="home-paint-surface-magenta"
                cx="0"
                cy="0"
                r="1"
                gradientTransform="translate(1260 770) rotate(154) scale(830 530)"
              >
                <stop
                  offset="0"
                  stopColor="var(--takeover-bloom-a)"
                  stopOpacity="0.3"
                />
                <stop
                  offset="1"
                  stopColor="var(--takeover-bloom-a)"
                  stopOpacity="0"
                />
              </radialGradient>
              <radialGradient
                id="home-paint-surface-blue"
                cx="0"
                cy="0"
                r="1"
                gradientTransform="translate(1660 790) rotate(-142) scale(770 520)"
              >
                <stop
                  offset="0"
                  stopColor="var(--takeover-bloom-b)"
                  stopOpacity="0.28"
                />
                <stop
                  offset="1"
                  stopColor="var(--takeover-bloom-b)"
                  stopOpacity="0"
                />
              </radialGradient>
              {/*
                Široki mirni bloom pod levom tekst zonom: podiže je taman toliko
                da ne bude mrtvo ravna, a ostaje dovoljno tamna da beli tekst
                radi bez tvrdog crnog panela iza njega.
              */}
              <radialGradient
                id="home-paint-surface-left"
                cx="0"
                cy="0"
                r="1"
                gradientTransform="translate(330 900) rotate(-14) scale(720 480)"
              >
                <stop offset="0" stopColor="#2b2540" stopOpacity="0.55" />
                <stop offset="1" stopColor="#2b2540" stopOpacity="0" />
              </radialGradient>
            </defs>
            <path
              d={TAKEOVER_SURFACE_PATH}
              fill="var(--takeover-canvas)"
              filter="url(#home-paint-surface-feather)"
              opacity="0.85"
            />
            <path d={TAKEOVER_SURFACE_PATH} fill="var(--takeover-canvas)" />
            <path
              d={TAKEOVER_SURFACE_PATH}
              fill="url(#home-paint-surface-left)"
            />
            <path
              d={TAKEOVER_SURFACE_PATH}
              fill="url(#home-paint-surface-magenta)"
            />
            <path
              d={TAKEOVER_SURFACE_PATH}
              fill="url(#home-paint-surface-blue)"
            />
          </svg>
        </div>

        <div className={styles.backgroundArtwork} aria-hidden="true" />
        <HybridPaintTakeoverArtwork
          ref={heroArtworkRef}
          artwork={heroArtwork}
          className={styles.heroArtwork}
        />
        <div className={styles.contentContrast} aria-hidden="true" />
        <div
          className={styles.colorWash}
          data-paint-color-wash=""
          aria-hidden="true"
        />

        <div className={styles.copy}>
          <p className={styles.eyebrow}>IZVAN POVRŠINE</p>
          <h2 id="paint-takeover-home-title" data-cursor="headline">
            <span>BOJA NIJE SLOJ.</span>
            <span>BOJA JE POKRET.</span>
          </h2>
          <p className={styles.description}>
            Sistem završne obrade u kome se priprema, preciznost i karakter
            susreću u jednom potezu.
          </p>
          <Link className={styles.primaryCta} href="/program">
            ISTRAŽITE SISTEME
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
      {debugEnabled ? (
        <PaintTakeoverDebugPanel snapshot={runtimeSnapshot} />
      ) : null}
    </section>
  );
}
