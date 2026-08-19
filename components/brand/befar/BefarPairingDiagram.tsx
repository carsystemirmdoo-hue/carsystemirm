"use client";

import { useState } from "react";
import { befarPairingMeta, befarPairings } from "@/lib/befar-brand-data";
import styles from "./BefarBrandPage.module.css";

/** Najveći prečnik u setu služi kao referenca za relativnu skalu krugova. */
const MAX_DIAMETER = Math.max(...befarPairings.map((pairing) => pairing.foam));

/**
 * Pravilo uparivanja pena ↔ podloška, nacrtano u relativnoj skali.
 *
 * Nije tabela: dva koncentrična kruga pokazuju da je podloška uvek manja od
 * pene. Prelaz je samo `scale` + `opacity` — bez rotacije, jer ova sekcija
 * govori o naleganju, ne o kretanju.
 */
export function BefarPairingDiagram() {
  const [index, setIndex] = useState(0);
  const active = befarPairings[index];

  const foamRatio = active.foam / MAX_DIAMETER;
  const plateRatio = active.plate / MAX_DIAMETER;

  return (
    <div className={styles.pairingLayout}>
      <div className={styles.pairingControls} role="group" aria-label="Prečnik pene">
        {befarPairings.map((pairing, i) => (
          <button
            aria-pressed={i === index}
            className={styles.pairingButton}
            data-active={i === index || undefined}
            key={pairing.foam}
            onClick={() => setIndex(i)}
            type="button"
          >
            <span className={styles.pairingButtonFoam}>{pairing.foam}</span>
            <span className={styles.pairingButtonArrow} aria-hidden="true">
              →
            </span>
            <span className={styles.pairingButtonPlate}>{pairing.plate}</span>
            <span className={styles.pairingButtonUnit}>mm</span>
          </button>
        ))}
      </div>

      <figure className={styles.pairingFigure}>
        <div className={styles.pairingRings}>
          <div
            className={styles.pairingFoamRing}
            style={{ "--befar-ring-scale": foamRatio } as React.CSSProperties}
          >
            <span className={styles.pairingRingLabel}>{active.foam} mm</span>
          </div>
          <div
            className={styles.pairingPlateRing}
            style={{ "--befar-ring-scale": plateRatio } as React.CSSProperties}
          >
            <span className={styles.pairingRingLabel}>{active.plate} mm</span>
          </div>
        </div>
        <figcaption className={styles.pairingCaption}>
          {active.foamLabel} nalaže podlošku od {active.plate} mm.
        </figcaption>
      </figure>

      <div className={styles.pairingSpec}>
        <p className={styles.pairingSpecLabel}>Podloška u našem programu</p>
        {active.plateCodes.length > 0 ? (
          <ul className={styles.pairingCodes}>
            {active.plateCodes.map((plate) => (
              <li key={plate.code}>
                <code className={styles.codeChip}>{plate.code}</code>
                <span>{plate.hardness}</span>
                <span className={styles.pairingCodeSize}>{active.plate} mm</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.pairingEmpty}>
            Podloška od {active.plate} mm trenutno nije deo našeg programa.
          </p>
        )}
        <p className={styles.pairingNote}>{befarPairingMeta.m14Note}</p>
      </div>
    </div>
  );
}
