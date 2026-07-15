"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  observeSiteTheme,
  readSiteTheme,
} from "@/components/map/carsystem-map-style";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import styles from "../CarsystemHomePage.module.css";

type SiteTheme = "light" | "dark";

type ProcessVisual = {
  phaseIndex: number;
  theme: SiteTheme;
};

type ProcessPhase = {
  title: string;
  process: "prep" | "primer" | "paint" | "clearcoat" | "polish";
  eyebrow: string;
  description: string;
  tags: string[];
  tint: string;
  shiftX: string;
  shiftY: string;
  scale: number;
  image: {
    alt: string;
    dark: string;
    light: string;
  };
};

const processPhases: ProcessPhase[] = [
  {
    title: "Priprema",
    process: "prep",
    eyebrow: "Faza 01",
    description:
      "Čišćenje, odmašćivanje i brušenje stvaraju stabilnu osnovu za svaki naredni sloj.",
    tags: ["Odmašćivači", "Abrazivi", "Maskiranje"],
    tint: "90 99 110",
    shiftX: "0%",
    shiftY: "0%",
    scale: 1,
    image: {
      alt: "Priprema branika abrazivom pre nanošenja refinish sistema",
      dark: "/images/process/dark/new-01.webp",
      light: "/images/process/light/new-01.webp",
    },
  },
  {
    title: "Podloga",
    process: "primer",
    eyebrow: "Faza 02",
    description:
      "Prajmeri, punila i izolatori daju površini ujednačenost, prianjanje i zaštitu.",
    tags: ["Prajmeri", "Punila", "Izolatori"],
    tint: "91 125 166",
    shiftX: "-1.2%",
    shiftY: "0.7%",
    scale: 1.025,
    image: {
      alt: "Ujednačena podloga naneta na pripremljen branik",
      dark: "/images/process/dark/new-02.webp",
      light: "/images/process/light/new-02.webp",
    },
  },
  {
    title: "Boja",
    process: "paint",
    eyebrow: "Faza 03",
    description:
      "Bazni sloj i precizna nijansa, uz miks sistem i tehničku proveru tona.",
    tags: ["Bazne boje", "Miks sistem", "Formule"],
    tint: "229 50 42",
    shiftX: "1.2%",
    shiftY: "-0.8%",
    scale: 1.045,
    image: {
      alt: "Nanošenje crvene bazne boje pištoljem za lakiranje",
      dark: "/images/process/dark/new-03.webp",
      light: "/images/process/light/new-03.webp",
    },
  },
  {
    title: "Lak",
    process: "clearcoat",
    eyebrow: "Faza 04",
    description:
      "Bezbojni lak donosi dubinu, zaštitu i kontrolisan sjaj u završnoj obradi.",
    tags: ["Bezbojni lak", "Učvršćivači", "Razređivači"],
    tint: "255 90 82",
    shiftX: "-0.8%",
    shiftY: "-1.1%",
    scale: 1.035,
    image: {
      alt: "Nanošenje bezbojnog laka za dubinu i zaštitu završnog sloja",
      dark: "/images/process/dark/new-04.webp",
      light: "/images/process/light/new-04.webp",
    },
  },
  {
    title: "Poliranje",
    process: "polish",
    eyebrow: "Faza 05",
    description:
      "Finalna dorada uklanja sitne tragove i podiže završni sjaj površine.",
    tags: ["Paste", "Podloške", "Mašine"],
    tint: "200 210 220",
    shiftX: "0.6%",
    shiftY: "0.4%",
    scale: 1.015,
    image: {
      alt: "Mašinsko poliranje branika do završnog visokog sjaja",
      dark: "/images/process/dark/new-05.webp",
      light: "/images/process/light/new-05.webp",
    },
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function PerfectFinishProcess() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const phaseRefs = useRef<Array<HTMLElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const visualRequestRef = useRef(0);
  const visualRafRef = useRef<number | null>(null);
  const visualTimerRef = useRef<number | null>(null);
  const activePhaseRef = useRef(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  const [activePhase, setActivePhase] = useState(0);
  const [theme, setTheme] = useState<SiteTheme | null>(null);
  const [displayedVisual, setDisplayedVisual] = useState<ProcessVisual | null>(null);
  const [previousVisual, setPreviousVisual] = useState<ProcessVisual | null>(null);
  const [imageTransitionReady, setImageTransitionReady] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);
  const phase = processPhases[activePhase];
  const visualPhase = displayedVisual
    ? processPhases[displayedVisual.phaseIndex]
    : phase;

  useEffect(() => {
    setTheme(readSiteTheme());
    return observeSiteTheme(setTheme);
  }, []);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion) {
      setIsRevealed(true);
      return undefined;
    }

    if (!("IntersectionObserver" in window)) {
      setIsRevealed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsRevealed(true);
        observer.disconnect();
      },
      {
        rootMargin: "0px 0px -10%",
        threshold: 0.14,
      },
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!theme) return undefined;

    const targetVisual: ProcessVisual = { phaseIndex: activePhase, theme };
    const targetPhase = processPhases[targetVisual.phaseIndex];
    const targetSrc = targetPhase.image[targetVisual.theme];

    if (!displayedVisual) {
      setDisplayedVisual(targetVisual);
      return undefined;
    }

    if (
      displayedVisual.phaseIndex === targetVisual.phaseIndex &&
      displayedVisual.theme === targetVisual.theme
    ) {
      return undefined;
    }

    const requestId = visualRequestRef.current + 1;
    visualRequestRef.current = requestId;
    let cancelled = false;
    const preload = new window.Image();
    preload.decoding = "async";

    const promoteVisual = () => {
      if (cancelled || requestId !== visualRequestRef.current) return;

      if (visualTimerRef.current !== null) {
        window.clearTimeout(visualTimerRef.current);
        visualTimerRef.current = null;
      }
      if (visualRafRef.current !== null) {
        window.cancelAnimationFrame(visualRafRef.current);
        visualRafRef.current = null;
      }

      if (prefersReducedMotion) {
        setPreviousVisual(null);
        setDisplayedVisual(targetVisual);
        setImageTransitionReady(true);
        return;
      }

      setPreviousVisual(displayedVisual);
      setDisplayedVisual(targetVisual);
      setImageTransitionReady(false);
      visualRafRef.current = window.requestAnimationFrame(() => {
        visualRafRef.current = null;
        setImageTransitionReady(true);
        visualTimerRef.current = window.setTimeout(() => {
          visualTimerRef.current = null;
          setPreviousVisual(null);
        }, 300);
      });
    };

    preload.onload = () => {
      if (typeof preload.decode === "function") {
        void preload.decode().catch(() => undefined).finally(promoteVisual);
        return;
      }
      promoteVisual();
    };
    preload.onerror = promoteVisual;
    preload.src = targetSrc;

    if (preload.complete) {
      preload.onload = null;
      if (typeof preload.decode === "function") {
        void preload.decode().catch(() => undefined).finally(promoteVisual);
      } else {
        promoteVisual();
      }
    }

    return () => {
      cancelled = true;
      preload.onload = null;
      preload.onerror = null;
    };
  }, [activePhase, displayedVisual, prefersReducedMotion, theme]);

  useEffect(() => {
    return () => {
      visualRequestRef.current += 1;
      if (visualRafRef.current !== null) window.cancelAnimationFrame(visualRafRef.current);
      if (visualTimerRef.current !== null) window.clearTimeout(visualTimerRef.current);
    };
  }, []);

  const setPhase = useCallback((index: number) => {
    const nextPhase = clamp(index, 0, processPhases.length - 1);
    if (nextPhase === activePhaseRef.current) return;

    activePhaseRef.current = nextPhase;
    setActivePhase(nextPhase);
  }, []);

  const updateActivePhase = useCallback(() => {
    const section = sectionRef.current;
    if (!section || prefersReducedMotion) return;

    const rect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    if (rect.bottom < viewportHeight * 0.12 || rect.top > viewportHeight * 0.9) {
      return;
    }

    const viewportTarget = viewportHeight * 0.52;
    let nextPhase = activePhaseRef.current;
    let closestDistance = Number.POSITIVE_INFINITY;

    phaseRefs.current.forEach((phaseCard, index) => {
      if (!phaseCard) return;

      const cardRect = phaseCard.getBoundingClientRect();
      const phaseCenter = cardRect.top + cardRect.height / 2;
      const distance = Math.abs(phaseCenter - viewportTarget);

      if (distance < closestDistance) {
        closestDistance = distance;
        nextPhase = index;
      }
    });

    setPhase(nextPhase);
  }, [prefersReducedMotion, setPhase]);

  useEffect(() => {
    if (prefersReducedMotion) return undefined;

    function scheduleUpdate() {
      if (rafRef.current !== null) return;

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        updateActivePhase();
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
  }, [prefersReducedMotion, updateActivePhase]);

  return (
    <section
      id="program"
      ref={sectionRef}
      className={`${styles.section} ${styles.railTarget}`}
      data-active-process={visualPhase.process}
      data-process-revealed={isRevealed ? "true" : "false"}
      aria-labelledby="process-title"
    >
      <div className={`${styles.sectionIntro} ${styles.processRevealIntro}`}>
        <p className={styles.sectionKicker}>Refinish proces</p>
        <h2 id="process-title">Od podloge do završnog sjaja.</h2>
        <p>
          Program prati logiku rada u lakirnici: priprema, podloga, boja, lak i
          završna obrada, uz materijale i podršku za svaku fazu.
        </p>
      </div>

      <div className={styles.processGrid}>
        <div className={`${styles.processVisual} ${styles.processRevealVisual}`}>
          <div
            className={`${styles.processImageFrame} cs-image-surface`}
            data-cursor="image"
            data-image-transition-ready={imageTransitionReady ? "true" : "false"}
            data-motion-surface
            data-process={visualPhase.process}
          >
            <span
              aria-hidden="true"
              className={styles.processImage}
              style={
                {
                  "--process-x": visualPhase.shiftX,
                  "--process-y": visualPhase.shiftY,
                  "--process-scale": visualPhase.scale,
                } as CSSProperties
              }
            />
            {[previousVisual, displayedVisual]
              .filter((visual): visual is ProcessVisual => visual !== null)
              .filter(
                (visual, index, visuals) =>
                  visuals.findIndex(
                    (item) =>
                      item.phaseIndex === visual.phaseIndex && item.theme === visual.theme,
                  ) === index,
              )
              .map((visual) => {
                const imagePhase = processPhases[visual.phaseIndex];
                const isCurrent =
                  displayedVisual?.phaseIndex === visual.phaseIndex &&
                  displayedVisual.theme === visual.theme;

                return (
                  <Image
                    alt={isCurrent ? imagePhase.image.alt : ""}
                    aria-hidden={isCurrent ? undefined : true}
                    className={`${styles.processImageAsset} ${
                      isCurrent
                        ? styles.processImageAssetCurrent
                        : styles.processImageAssetPrevious
                    }`}
                    fill
                    key={`${visual.theme}-${imagePhase.process}`}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    sizes="(max-width: 860px) 100vw, 46vw"
                    src={imagePhase.image[visual.theme]}
                    style={
                      {
                        "--process-x": imagePhase.shiftX,
                        "--process-y": imagePhase.shiftY,
                        "--process-scale": imagePhase.scale,
                      } as CSSProperties
                    }
                  />
                );
              })}
            <div
              className={styles.processTint}
              style={{ "--phase-tint": visualPhase.tint } as CSSProperties}
            />
            <div className={styles.phasePips} aria-hidden="true">
              {processPhases.map((item, index) => (
                <span
                  key={item.title}
                  className={
                    index === displayedVisual?.phaseIndex ? styles.activePip : undefined
                  }
                />
              ))}
            </div>
            <div className={styles.processOverlay}>
              <span className={styles.processNumber}>
                {String((displayedVisual?.phaseIndex ?? activePhase) + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{visualPhase.title}</h3>
                <p>{visualPhase.description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={`${styles.phaseList} ${styles.processRevealList}`}>
          {processPhases.map((item, index) => (
            <article
              key={item.title}
              ref={(node) => {
                phaseRefs.current[index] = node;
              }}
              className={styles.phaseBlock}
            >
              <button
                type="button"
                className={`${styles.phaseCard} cs-process-surface ${
                  index === activePhase ? styles.phaseCardActive : ""
                }`}
                data-cursor="process"
                data-process={item.process}
                data-motion-surface
                onClick={() => setPhase(index)}
                onFocus={() => setPhase(index)}
                aria-current={index === activePhase ? "step" : undefined}
                aria-pressed={index === activePhase}
              >
                <span className={styles.phaseMeta}>
                  <span />
                  {item.eyebrow}
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className={styles.tagRow}>
                  {item.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </span>
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
