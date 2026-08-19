"use client";

import { useState, type KeyboardEvent } from "react";
import { norbinGreyShades } from "./norbinBrandData";
import styles from "./NorbinBrandPage.module.css";

export function NorbinGreyShade() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = norbinGreyShades[activeIndex];

  function selectAndFocus(index: number) {
    const normalized =
      (index + norbinGreyShades.length) % norbinGreyShades.length;
    setActiveIndex(normalized);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectAndFocus(activeIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectAndFocus(activeIndex - 1);
    }
  }

  return (
    <fieldset className={styles.greyShadeControl}>
      <legend className="sr-only">Izaberite tačku na skali sivih tonova</legend>

      <div className={styles.greyBar} aria-hidden="true">
        <span
          className={styles.greyMarker}
          style={{ left: `${active.position}%` }}
        />
      </div>

      <div className={styles.greyStops} role="radiogroup" aria-label="Skala sivih tonova">
        {norbinGreyShades.map((shade, index) => (
          <button
            type="button"
            role="radio"
            aria-checked={activeIndex === index}
            key={shade.id}
            onClick={() => selectAndFocus(index)}
            onKeyDown={handleKeyDown}
          >
            <strong>{shade.label}</strong>
            <span>{shade.detail}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
