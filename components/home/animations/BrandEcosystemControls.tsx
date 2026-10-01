"use client";

import type { CSSProperties } from "react";
import type { ProgramCategory } from "@/components/home/animations/BrandEcosystemCards";
import styles from "../CarsystemHomePage.module.css";

export function BrandEcosystemControls({
  activeIndex,
  autoplayMs,
  categories,
  isAutoplayRunning,
  onActivate,
  progressCycle,
}: {
  activeIndex: number;
  autoplayMs: number;
  categories: ProgramCategory[];
  isAutoplayRunning: boolean;
  onActivate: (index: number) => void;
  progressCycle: number;
}) {
  return (
    <div className={styles.programDeckProgress} aria-label="Izaberite programsku celinu">
      <span>{categories[activeIndex].number}</span>
      <div>
        {categories.map((category, index) => (
          <button
            type="button"
            key={category.id}
            className={index === activeIndex ? styles.programDeckProgressActive : ""}
            aria-label={`Pređite na program ${index + 1}: ${category.title}`}
            aria-pressed={index === activeIndex}
            data-cursor="button"
            style={
              {
                "--autoplay-ms": `${autoplayMs}ms`,
              } as CSSProperties
            }
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") onActivate(index);
            }}
            onFocus={() => onActivate(index)}
            onClick={() => onActivate(index)}
          >
            {index === activeIndex && isAutoplayRunning ? (
              <span
                key={`${index}-${progressCycle}`}
                className={styles.programDeckProgressFill}
                aria-hidden="true"
              />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function BrandEcosystemMobileControls({
  activeIndex,
  categories,
  onActivate,
}: {
  activeIndex: number;
  categories: ProgramCategory[];
  onActivate: (index: number) => void;
}) {
  return (
    <div className={styles.programMobileControls} aria-label="Izaberite program">
      {categories.map((category, index) => (
        <button
          type="button"
          key={category.id}
          className={index === activeIndex ? styles.programMobileDotActive : ""}
          onFocus={() => onActivate(index)}
          onClick={() => onActivate(index)}
          aria-label={`Prikažite ${category.title}`}
          aria-pressed={index === activeIndex}
        />
      ))}
    </div>
  );
}
