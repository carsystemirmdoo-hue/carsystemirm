"use client";

import Link from "next/link";
import { useState } from "react";
import {
  baslacCatalogHref,
  baslacProcessSteps,
} from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

export function BaslacProcessNavigator() {
  const [activeId, setActiveId] = useState(baslacProcessSteps[0].id);
  const activeStep =
    baslacProcessSteps.find((step) => step.id === activeId) ??
    baslacProcessSteps[0];

  return (
    <div className={styles.processNavigator}>
      <div className={styles.processRail} aria-label="Faze baslac procesa">
        {baslacProcessSteps.map((step) => (
          <button
            type="button"
            aria-pressed={step.id === activeStep.id}
            data-active={step.id === activeStep.id || undefined}
            key={step.id}
            onClick={() => setActiveId(step.id)}
          >
            <span>{step.index}</span>
            <strong>{step.title}</strong>
          </button>
        ))}
      </div>

      <div className={styles.processDetail} key={activeStep.id}>
        <span className={styles.processDetailNumber} aria-hidden="true">
          {activeStep.index}
        </span>
        <div>
          <p>Aktivna faza</p>
          <h3>{activeStep.title}</h3>
          <p>{activeStep.description}</p>
        </div>
        <div className={styles.processGroups}>
          <p>Pripadajući proizvodi i sistemi</p>
          <div>
            {activeStep.productGroups.map((group) => (
              <span key={group}>{group}</span>
            ))}
          </div>
          <Link
            href={baslacCatalogHref({ query: activeStep.query })}
            aria-label={`Pretražite katalog za fazu ${activeStep.title}`}
          >
            Pretražite javni katalog
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
