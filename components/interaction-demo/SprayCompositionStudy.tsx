"use client";

import Image from "next/image";
import { useCallback, useState, type CSSProperties } from "react";
import { ProductHeroSprayBackdrop } from "@/components/product/ProductHeroSprayBackdrop";
import {
  COMPOSITIONS,
  COMPOSITION_ORDER,
  compositionTokens,
} from "@/components/interaction-demo/sprayComposition.mjs";
import fit from "@/components/product/ProductImageFit.generated.module.css";
import styles from "./SprayCompositionStudy.module.css";

/**
 * Spray composition study — INTERNAL. No public route imports this.
 *
 * The animation is NOT reimplemented. `ProductHeroSprayBackdrop` is the real
 * production component, imported unmodified, so the paths, keyframes, stroke
 * order, durations, easing, trigger and reduced-motion behaviour in every
 * column are the ones already approved. What varies between columns is only:
 *
 *   · `--product-stage-spray-scale`    — how large the art layer is drawn
 *   · `--product-stage-spray-offset-x` — where the art band is centred
 *   · `--study-product-scale`          — a lab-only multiplier on the product
 *                                        envelope (the alpha bounding-box
 *                                        content fit itself is untouched)
 *
 * The first two are hooks the production stylesheet already exposes; the study
 * drives the same knobs a future production change would.
 */

export type StudyCase = {
  slug: string;
  name: string;
  label: string;
  why: string;
  imageSrc: string;
  imageAlt: string;
  sizeClass: string;
  stageFormat: string;
  contrastMode: string;
  visualStyle: Record<string, string>;
};

function StageColumn({
  compositionKey,
  studyCase,
  theme,
  runId,
}: {
  compositionKey: string;
  studyCase: StudyCase;
  theme: "light" | "dark";
  runId: number;
}) {
  const composition = COMPOSITIONS[compositionKey as keyof typeof COMPOSITIONS];
  const tokens = compositionTokens(compositionKey);

  return (
    <div className={styles.column}>
      <div
        className={`${styles.stage} ${fit.fit}`}
        data-product-hero-visual
        data-study-composition={compositionKey}
        data-study-case={studyCase.name}
        data-scene-theme={theme}
        data-product-contrast={studyCase.contrastMode}
        data-size-class={studyCase.sizeClass}
        data-stage-format={studyCase.stageFormat}
        data-product-fit={studyCase.imageSrc}
        style={{ ...studyCase.visualStyle, ...tokens } as CSSProperties}
      >
        <span className={styles.plate} aria-hidden="true" />
        {/* The production animation, unmodified. */}
        <ProductHeroSprayBackdrop key={`${compositionKey}-${runId}`} />
        <span className={styles.halo} aria-hidden="true" />
        <span className={styles.productLayer} data-study-product>
          <Image
            src={studyCase.imageSrc}
            alt={studyCase.imageAlt}
            fill
            sizes="360px"
          />
        </span>
      </div>
      <div className={styles.columnMeta}>
        <strong>{composition.label}</strong>
        <small>{composition.note}</small>
        <small>
          art ×{composition.artScale} · proizvod ×{composition.productScale} ·
          offset {tokens["--product-stage-spray-offset-x"]}
        </small>
      </div>
    </div>
  );
}

export function SprayCompositionStudy({ cases }: { cases: StudyCase[] }) {
  const [runId, setRunId] = useState(0);
  const replayAll = useCallback(() => setRunId((id) => id + 1), []);

  return (
    <main className={styles.page}>
      <header className={styles.masthead}>
        <span className={styles.kicker}>Interno · nije javna stranica</span>
        <h1>Spray kompoziciona studija</h1>
        <p>
          Ista, <strong>nepromenjena</strong> produkcijska animacija u sve tri
          kolone — <code>ProductHeroSprayBackdrop</code> je uvezen takav kakav
          jeste. Putanje, keyframes, trajanje, easing, redosled poteza, trigger,
          boja i reduced-motion ponašanje nisu dirani.
        </p>
        <p>
          Menja se isključivo prostorni odnos: veličina art sloja
          (<code>--product-stage-spray-scale</code>), njegovo centriranje
          (<code>--product-stage-spray-offset-x</code>) i lab-only množilac
          veličine proizvoda. Content-fit po alfa bounding-box-u je identičan u
          sve tri kolone.
        </p>
        <p className={styles.note}>
          Izmereno na produkciji (1440 px, scena 537×645): art pojas je{" "}
          <strong>291×355 px</strong>, a njegov centar je <strong>26 px levo</strong>{" "}
          od centra proizvoda. Zato je desna strana izgladnela — potez je vidljiv
          33% levo i samo 15% desno kod Effect Gold 451. Cilj je 25–35% sa obe
          strane, pa širenje bez recentriranja ne bi pomoglo.
        </p>
        <button className={styles.replay} type="button" onClick={replayAll} style={{ position: "static", marginTop: "0.8rem" }}>
          Replay sve
        </button>
      </header>

      {cases.map((studyCase) => (
        <section className={styles.caseBlock} key={studyCase.name}>
          <div className={styles.caseHead}>
            <h2>{studyCase.label}</h2>
            <span>
              {studyCase.slug} · {studyCase.contrastMode} · skala{" "}
              {studyCase.sizeClass}
            </span>
          </div>
          <p className={styles.note}>{studyCase.why}</p>

          <div className={styles.row} data-study-theme="light">
            {COMPOSITION_ORDER.map((key: string) => (
              <StageColumn
                compositionKey={key}
                key={`${studyCase.name}-${key}`}
                runId={runId}
                studyCase={studyCase}
                theme="light"
              />
            ))}
          </div>

          <div className={`${styles.darkBlock} dark`} style={{ marginTop: "0.9rem" }}>
            <div className={styles.row} data-study-theme="dark">
              {COMPOSITION_ORDER.map((key: string) => (
                <StageColumn
                  compositionKey={key}
                  key={`${studyCase.name}-dark-${key}`}
                  runId={runId}
                  studyCase={studyCase}
                  theme="dark"
                />
              ))}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
