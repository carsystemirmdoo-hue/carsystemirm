"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./CarsystemHomePage.module.css";

type Theme = "dark" | "light";

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
};

const processPhases: ProcessPhase[] = [
  {
    title: "Priprema",
    process: "prep",
    eyebrow: "Faza 01",
    description:
      "Čišćenje, odmašćivanje i brušenje površine do stabilne osnove za svaki naredni sloj.",
    tags: ["Odmašćivači", "Abrazivi", "Maskiranje"],
    tint: "90 99 110",
    shiftX: "0%",
    shiftY: "0%",
    scale: 1,
  },
  {
    title: "Podloga",
    process: "primer",
    eyebrow: "Faza 02",
    description:
      "Prajmer, ispuna i izolacija daju površini ujednačenost, prianjanje i zaštitu.",
    tags: ["Prajmeri", "Punila", "Izolatori"],
    tint: "91 125 166",
    shiftX: "-1.2%",
    shiftY: "0.7%",
    scale: 1.025,
  },
  {
    title: "Boja",
    process: "paint",
    eyebrow: "Faza 03",
    description:
      "Bazni sloj i precizna nijansa, uz mikseve boja i tehničku proveru za savršen ton.",
    tags: ["Bazne boje", "Miks sistem", "Formule"],
    tint: "229 50 42",
    shiftX: "1.2%",
    shiftY: "-0.8%",
    scale: 1.045,
  },
  {
    title: "Lak",
    process: "clearcoat",
    eyebrow: "Faza 04",
    description:
      "Završni clear coat donosi dubinu, zaštitu i kontrolisan sjaj u profesionalnoj obradi.",
    tags: ["Clear coat", "Učvršćivači", "Razređivači"],
    tint: "255 90 82",
    shiftX: "-0.8%",
    shiftY: "-1.1%",
    scale: 1.035,
  },
  {
    title: "Poliranje",
    process: "polish",
    eyebrow: "Faza 05",
    description:
      "Finalna dorada vraća površini visok sjaj, čist odsjaj i stabilan završni rezultat.",
    tags: ["Paste", "Podloške", "Mašine"],
    tint: "200 210 220",
    shiftX: "0.6%",
    shiftY: "0.4%",
    scale: 1.015,
  },
];

export function ProcessSection({ theme }: { theme: Theme }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const phaseRefs = useRef<Array<HTMLElement | null>>([]);
  const rafRef = useRef<number | null>(null);
  const activePhaseRef = useRef(0);
  const [activePhase, setActivePhase] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const phase = processPhases[activePhase];

  const setPhase = useCallback((index: number) => {
    activePhaseRef.current = index;
    setActivePhase(index);
  }, []);

  const updateActivePhase = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;

    const sectionRect = section.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    if (reduceMotion || sectionRect.bottom < 0 || sectionRect.top > viewportHeight) {
      return;
    }

    const viewportTarget = viewportHeight * 0.52;
    let nextPhase = activePhaseRef.current;
    let closestDistance = Number.POSITIVE_INFINITY;

    phaseRefs.current.forEach((phaseCard, index) => {
      if (!phaseCard) return;
      const rect = phaseCard.getBoundingClientRect();
      const phaseCenter = rect.top + rect.height / 2;
      const distance = Math.abs(phaseCenter - viewportTarget);

      if (distance < closestDistance) {
        closestDistance = distance;
        nextPhase = index;
      }
    });

    if (nextPhase !== activePhaseRef.current) {
      setPhase(nextPhase);
    }
  }, [reduceMotion, setPhase]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");

    function updateMotionPreference() {
      const shouldReduce = media.matches;
      setReduceMotion(shouldReduce);
      if (shouldReduce) setPhase(0);
    }

    updateMotionPreference();
    media.addEventListener("change", updateMotionPreference);

    return () => media.removeEventListener("change", updateMotionPreference);
  }, [setPhase]);

  useEffect(() => {
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
      }
    };
  }, [updateActivePhase]);

  return (
    <section
      id="program"
      ref={sectionRef}
      className={styles.section}
      aria-labelledby="process-title"
    >
      <div className={styles.sectionIntro}>
        <p className={styles.sectionKicker}>Refinish proces, 5 faza</p>
        <h2 id="process-title">Proces savršenog finiša.</h2>
        <p>
          Vodimo profesionalce kroz svaki korak, sa pravim materijalima, opremom
          i tehničkom podrškom u svakoj fazi.
        </p>
      </div>

      <div className={styles.processGrid}>
        <div className={styles.processVisual}>
          <div className={`${styles.processImageFrame} cs-image-surface`} data-cursor="image" data-motion-surface>
            <Image
              src={theme === "dark" ? "/images/home/hero-dark.png" : "/images/home/hero-light.png"}
              alt="Profesionalni lakirer radi na braniku u komori"
              fill
              priority
              sizes="(min-width: 900px) 42vw, 100vw"
              className={styles.processImage}
              style={
                {
                  "--process-x": phase.shiftX,
                  "--process-y": phase.shiftY,
                  "--process-scale": phase.scale,
                } as CSSProperties
              }
            />
            <div
              className={styles.processTint}
              style={{ "--phase-tint": phase.tint } as CSSProperties}
            />
            <div className={styles.phasePips} aria-hidden="true">
              {processPhases.map((item, index) => (
                <span
                  key={item.title}
                  className={index === activePhase ? styles.activePip : undefined}
                />
              ))}
            </div>
            <div className={styles.processOverlay}>
              <span className={styles.processNumber}>
                {String(activePhase + 1).padStart(2, "0")}
              </span>
              <div>
                <h3>{phase.title}</h3>
                <p>{phase.description}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.phaseList}>
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
