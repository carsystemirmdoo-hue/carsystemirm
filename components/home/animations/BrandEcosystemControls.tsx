"use client";

import type { CSSProperties } from "react";
import type { ProgramCategory } from "@/components/home/animations/BrandEcosystemCards";
import styles from "../CarsystemHomePage.module.css";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getProgressDashFill(index: number, activeIndex: number, progress: number, count: number) {
  const maxIndex = Math.max(1, count - 1);

  if (index < activeIndex) return 1;
  if (index > activeIndex) return 0;
  if (index === maxIndex) return 1;

  return clamp((progress - index / maxIndex) * maxIndex, 0, 1);
}

export function BrandEcosystemControls({
  activeIndex,
  categories,
  deckProgress,
  onActivate,
}: {
  activeIndex: number;
  categories: ProgramCategory[];
  deckProgress: number;
  onActivate: (index: number) => void;
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
            data-complete={index < activeIndex || undefined}
            style={
              {
                "--dash-fill": getProgressDashFill(
                  index,
                  activeIndex,
                  deckProgress,
                  categories.length,
                ),
              } as CSSProperties
            }
            onClick={() => onActivate(index)}
          />
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
          onClick={() => onActivate(index)}
          aria-label={`Prikaži ${category.title}`}
          aria-pressed={index === activeIndex}
        />
      ))}
    </div>
  );
}
