"use client";

import Link from "next/link";
import { useState } from "react";
import { BaslacMediaSlot } from "./BaslacMediaSlot";
import {
  baslacCatalogHref,
  baslacMedia,
  baslacRepairProcesses,
  type BaslacMediaAvailability,
} from "./baslacBrandData";
import styles from "./BaslacBrandPage.module.css";

export function BaslacRepairRhythm({
  availability,
}: {
  availability: BaslacMediaAvailability;
}) {
  const [activeId, setActiveId] = useState(baslacRepairProcesses[0].id);
  const activeProcess =
    baslacRepairProcesses.find((process) => process.id === activeId) ??
    baslacRepairProcesses[0];
  const media = baslacMedia["repair-rhythm"];

  return (
    <section
      id="repair-rhythm"
      className={`${styles.section} ${styles.repairRhythm}`}
      aria-labelledby="baslac-rhythm-title"
    >
      <div className={styles.repairRhythmHeader}>
        <div>
          <p className={styles.sectionKicker}>Proces određuje kombinaciju</p>
          <h2 id="baslac-rhythm-title">
            Ne birate samo limenku.
            <br />
            Birate ritam popravke.
          </h2>
        </div>
        <p>
          Standardna, brza, wet-on-wet ili ambient popravka ne razlikuju se
          samo po vremenu sušenja. Svaki proces povezuje određenu pripremu,
          bazu, bezbojni lak, učvršćivač i uslove rada.
        </p>
      </div>

      <div className={styles.repairRhythmGrid}>
        <BaslacMediaSlot
          availability={availability[media.id]}
          className={styles.repairRhythmMedia}
          media={media}
        />

        <div className={styles.repairRhythmPanel}>
          <div
            className={styles.repairRhythmSelector}
            role="group"
            aria-label="Izaberite proces popravke"
          >
            {baslacRepairProcesses.map((process) => (
              <button
                type="button"
                aria-pressed={activeId === process.id}
                data-active={activeId === process.id || undefined}
                key={process.id}
                onClick={() => setActiveId(process.id)}
              >
                {process.shortTitle}
              </button>
            ))}
          </div>

          <div className={styles.repairRhythmDetail}>
            <p>Aktivni radni tok</p>
            <h3>{activeProcess.title}</h3>
            <p>{activeProcess.description}</p>

            <ol>
              {activeProcess.stages.map((stage, index) => (
                <li key={stage}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  {stage}
                </li>
              ))}
            </ol>

            <div className={styles.repairRhythmProducts}>
              <p>Pripadajuće grupe proizvoda</p>
              <div>
                {activeProcess.productGroups.map((group) => (
                  <span key={group}>{group}</span>
                ))}
              </div>
            </div>

            <Link href={baslacCatalogHref()}>
              Otvorite Baslac katalog
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
