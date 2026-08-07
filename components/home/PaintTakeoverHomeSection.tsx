"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { PaintTakeoverRuntimeSnapshot } from "@/components/paint-takeover/paintTakeoverTypes";
import { usePaintTakeoverMotion } from "@/components/paint-takeover/usePaintTakeoverMotion";
import { PaintTakeoverDebugPanel } from "./PaintTakeoverDebugPanel";
import styles from "./PaintTakeoverHomeSection.module.css";

type PaintTakeoverHomeSectionProps = {
  debugEnabled?: boolean;
  washDisabled?: boolean;
};

/*
 * Wipe je usidren za GORNJU ivicu scene i putuje naniže.
 *
 * Ranije je krivina kretala sa ~89% visine ploče i išla naviše. Pošto se pri
 * ulasku vidi samo GORNJI deo ploče, tamno je postajalo vidljivo tek na ~55%
 * ulaska — do tada se skrolovalo kroz praznu belu površinu. Sada tamno ulazi
 * tačno na granici sa prethodnim blokom i raste naniže, pa je promena vidljiva
 * od prvog piksela ploče.
 *
 * Puni se IZNAD krivine, do y=-2000 (daleko van viewBox-a), da površina nikad
 * ne bude traka bez obzira na trenutni offset.
 */
const HOME_TAKEOVER_SURFACE_PATH =
  "M-40 310 C260 365 580 380 920 345 C1300 304 1650 230 1960 160 L1960 -2000 L-40 -2000Z";

const HOME_ARTWORK_REVEAL_PATHS = [
  {
    d: "M-320 880 C260 850 760 710 1230 500 C1600 342 1900 266 2220 120",
    width: 250,
  },
  {
    d: "M2200 220 C1780 382 1370 462 930 590 C510 708 120 746 -300 790",
    width: 210,
  },
  {
    d: "M850 -230 C1018 -92 1144 118 1280 312 C1420 514 1608 654 1810 770",
    width: 190,
  },
  {
    d: "M300 1280 C510 1040 720 720 968 446 C1088 314 1188 194 1320 94",
    width: 190,
  },
  {
    d: "M-240 900 C300 852 860 824 1500 760",
    width: 100,
  },
  {
    d: "M2160 790 C1780 388 1260 250 780 450",
    width: 92,
  },
] as const;

export function PaintTakeoverHomeSection({
  debugEnabled = false,
  washDisabled = false,
}: PaintTakeoverHomeSectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const lineworkRef = useRef<HTMLDivElement>(null);
  const lastDebugPublishRef = useRef(0);
  const [runtimeSnapshot, setRuntimeSnapshot] =
    useState<PaintTakeoverRuntimeSnapshot | null>(null);

  const handleRuntimeSnapshot = useCallback(
    (snapshot: PaintTakeoverRuntimeSnapshot) => {
      if (
        snapshot.timestamp - lastDebugPublishRef.current < 120 &&
        snapshot.progress > 0 &&
        snapshot.progress < 1
      ) {
        return;
      }
      lastDebugPublishRef.current = snapshot.timestamp;
      setRuntimeSnapshot(snapshot);
    },
    [],
  );

  usePaintTakeoverMotion({
    sectionRef,
    lineworkRef,
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
            viewBox="0 0 1920 1080"
          >
            <path d={HOME_TAKEOVER_SURFACE_PATH} fill="var(--takeover-canvas)" />
          </svg>
        </div>

        <div className={styles.backgroundArtwork} aria-hidden="true" />
        <div ref={lineworkRef} className={styles.heroArtwork} aria-hidden="true">
          <svg
            focusable="false"
            preserveAspectRatio="xMidYMid slice"
            viewBox="0 0 1920 1080"
          >
            <defs>
              <mask
                id="home-paint-artwork-reveal"
                x="-420"
                y="-320"
                width="2820"
                height="1900"
                maskUnits="userSpaceOnUse"
              >
                <rect
                  x="-420"
                  y="-320"
                  width="2820"
                  height="1900"
                  fill="black"
                />
                {HOME_ARTWORK_REVEAL_PATHS.map((line, index) => (
                  <path
                    key={line.d}
                    data-paint-line={index + 1}
                    d={line.d}
                    fill="none"
                    opacity="0"
                    pathLength="1"
                    stroke="white"
                    strokeDasharray="1"
                    strokeDashoffset="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={line.width}
                  />
                ))}
                <rect
                  data-paint-detail-reveal=""
                  x="-420"
                  y="-320"
                  width="2820"
                  height="1900"
                  fill="white"
                  opacity="0"
                />
              </mask>
            </defs>
            <image
              href="/art/paint-takeover/paint-takeover-hero-strokes-final.svg"
              width="1920"
              height="1080"
              mask="url(#home-paint-artwork-reveal)"
              preserveAspectRatio="xMidYMid slice"
            />
          </svg>
        </div>
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
