"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  befarAttachmentLabels,
  befarHardnessMeta,
  type BefarHardnessStep,
} from "@/lib/befar-brand-data";
import styles from "./BefarBrandPage.module.css";

type Props = { steps: BefarHardnessStep[] };

/** Prag širine na kojoj sekcija prelazi u sticky scenu (usklađeno sa CSS-om). */
const DESKTOP_QUERY = "(min-width: 64rem)";

export function BefarHardnessScale({ steps }: Props) {
  /**
   * JEDAN source of truth za aktivni korak. I scroll (preko IntersectionObserver-a)
   * i klik/tastatura pišu u isti `activeIndex`. Nema drugog izvedenog stanja,
   * nema akumulacije smera — zato reverse scroll i ponovni ulazak u sekciju rade
   * bez zaglavljivanja.
   */
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDesktop, setIsDesktop] = useState(false);

  const markerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const listboxId = useId();

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  /**
   * Scroll → aktivni korak, isključivo na desktopu.
   *
   * `rootMargin: -50% 0 -50%` svodi root na jednu liniju u sredini viewporta, pa
   * u svakom trenutku seče najviše jedan marker. Nema scroll listenera, nema
   * rAF petlje, nema snap-a i ne dira se korisnikov wheel/touch.
   */
  useEffect(() => {
    if (!isDesktop) return;

    const markers = markerRefs.current.filter(Boolean) as HTMLDivElement[];
    if (markers.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        /*
         * Pri brzom skrolu observer može dostaviti više entry-ja u jednom
         * callback-u, a njihov redosled u nizu NIJE prostorni. Uzimanje
         * poslednjeg je race condition — mogao je pobediti marker koji je dalje
         * od sredine i korak bi preskočio ili treperio.
         *
         * Zato se među presečenim markerima bira onaj čiji je centar najbliži
         * sredini viewporta. Rezultat je isti bez obzira na smer skrola i na
         * redosled entry-ja, pa reverse scroll i mali trackpad delte daju
         * deterministički korak.
         */
        let bestIndex: number | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        const viewportCenter = window.innerHeight / 2;

        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.stepIndex);
          if (!Number.isInteger(index)) continue;
          const rect = entry.boundingClientRect;
          const distance = Math.abs(rect.top + rect.height / 2 - viewportCenter);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        }

        if (bestIndex !== null) setActiveIndex(bestIndex);
      },
      { rootMargin: "-50% 0px -50% 0px", threshold: 0 },
    );

    markers.forEach((marker) => observer.observe(marker));
    return () => observer.disconnect();
  }, [isDesktop]);

  /** Klik na korak: na desktopu skroluje do markera, na mobilnom samo menja stanje. */
  const selectStep = useCallback(
    (index: number) => {
      setActiveIndex(index);
      if (!isDesktop) return;
      markerRefs.current[index]?.scrollIntoView({ block: "center", behavior: "smooth" });
    },
    [isDesktop],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const last = steps.length - 1;
      let next: number | null = null;

      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = Math.min(activeIndex + 1, last);
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = Math.max(activeIndex - 1, 0);
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = last;

      if (next === null) return;
      event.preventDefault();
      selectStep(next);
      optionRefs.current[next]?.focus();
    },
    [activeIndex, selectStep, steps.length],
  );

  const active = steps[activeIndex] ?? steps[0];

  return (
    <section
      aria-labelledby="befar-hardness-title"
      className={`${styles.hardness} ${styles.anchor}`}
      id="tvrdoca"
    >
      <div className={styles.hardnessIntro}>
        <div className={styles.container}>
          <p className={styles.sectionIndex}>
            <span>03</span> Skala tvrdoće
          </p>
          <h2 className={styles.sectionTitle} id="befar-hardness-title">
            {befarHardnessMeta.title}
          </h2>
          <p className={styles.sectionLead}>{befarHardnessMeta.lead}</p>
        </div>
      </div>

      <div className={styles.hardnessTrack}>
        {/* Markeri postoje samo da bi scroll pozicija imala deterministički izvor.
            Na mobilnom im CSS uklanja visinu, pa observer ni ne radi. */}
        <div aria-hidden="true" className={styles.hardnessMarkers}>
          {steps.map((step, index) => (
            <div
              className={styles.hardnessMarker}
              data-step-index={index}
              key={step.id}
              ref={(node) => {
                markerRefs.current[index] = node;
              }}
            />
          ))}
        </div>

        <div className={styles.hardnessStage}>
          <div className={`${styles.container} ${styles.hardnessGrid}`}>
            {/* ------------------------------------------------ LEVO: skala */}
            <div className={styles.hardnessNav}>
              <p className={styles.hardnessNavLabel}>{befarHardnessMeta.scaleLabel}</p>
              <div
                aria-activedescendant={`${listboxId}-${active.id}`}
                aria-label="Izbor tvrdoće pene"
                className={styles.hardnessOptions}
                onKeyDown={onKeyDown}
                role="listbox"
                tabIndex={-1}
              >
                {steps.map((step, index) => {
                  const isActive = index === activeIndex;
                  return (
                    <button
                      aria-selected={isActive}
                      className={styles.hardnessOption}
                      data-active={isActive || undefined}
                      id={`${listboxId}-${step.id}`}
                      key={step.id}
                      onClick={() => selectStep(index)}
                      ref={(node) => {
                        optionRefs.current[index] = node;
                      }}
                      role="option"
                      tabIndex={isActive ? 0 : -1}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={styles.hardnessBar}
                        data-outline={step.swatchNeedsOutline || undefined}
                        style={{ background: step.swatch }}
                      />
                      <span className={styles.hardnessOptionText}>
                        <span className={styles.hardnessOptionName}>{step.colorName}</span>
                        <span className={styles.hardnessOptionStars}>
                          <StarMeter value={step.stars} />
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className={styles.hardnessLineNote}>{befarHardnessMeta.lineNote}</p>
            </div>

            {/* ------------------------------------------- SREDINA: objekat */}
            <div className={styles.hardnessObject}>
              <div className={styles.hardnessObjectFrame}>
                {steps.map((step, index) => (
                  <div
                    className={styles.hardnessObjectLayer}
                    data-active={index === activeIndex || undefined}
                    key={step.id}
                    /* Optički offset iz data konfiguracije, ne iz nth-child CSS-a. */
                    style={
                      {
                        "--befar-offset-x": `${step.offset?.x ?? 0}%`,
                        "--befar-offset-y": `${step.offset?.y ?? 0}%`,
                      } as React.CSSProperties
                    }
                  >
                    <Image
                      alt={step.image.alt}
                      className={styles.hardnessObjectImage}
                      height={step.image.height}
                      sizes="(min-width: 64rem) 40vw, 86vw"
                      src={step.image.src}
                      width={step.image.width}
                    />
                  </div>
                ))}
              </div>
              <p className={styles.hardnessObjectCaption} aria-hidden="true">
                {active.colorName} · {active.codes[0]?.size ?? ""}
              </p>
            </div>

            {/* ------------------------------------------- DESNO: tehnički */}
            <div className={styles.hardnessSpec} aria-live="polite">
              <p className={styles.hardnessSpecStars}>
                <StarMeter value={active.stars} />
                <span className={styles.hardnessSpecStarsText}>{active.stars}/5</span>
              </p>
              <h3 className={styles.hardnessSpecTitle}>{active.colorName}</h3>
              <p className={styles.hardnessSpecPurpose}>{active.purpose}</p>

              <dl className={styles.hardnessSpecList}>
                <div>
                  <dt>Radi se sa</dt>
                  <dd>{active.applyWith}</dd>
                </div>
                <div>
                  <dt>Šifre u našem programu</dt>
                  <dd>
                    <ul className={styles.hardnessCodes}>
                      {active.codes.map((entry) => (
                        <li key={`${entry.code}-${entry.attachment}`}>
                          <code className={styles.codeChip}>{entry.code}</code>
                          <span>{entry.size}</span>
                          <span className={styles.hardnessAttachment}>
                            {befarAttachmentLabels[entry.attachment]}
                          </span>
                          {entry.stockEvidence === "recent-zero" ? (
                            <span className={styles.hardnessFlag}>po dogovoru</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>

              {active.note ? <p className={styles.hardnessNote}>{active.note}</p> : null}

              {active.productSlug ? (
                <Link className={styles.inlineLink} href={`/proizvodi/${active.productSlug}`}>
                  Pogledajte proizvod
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Diskretni meter tvrdoće — nije generički rating widget. Tekst ekvivalent nosi `aria-label`. */
function StarMeter({ value }: { value: number }) {
  return (
    <span aria-label={`Tvrdoća ${value} od 5`} className={styles.starMeter} role="img">
      {[1, 2, 3, 4, 5].map((slot) => (
        <span data-on={slot <= value || undefined} key={slot} />
      ))}
    </span>
  );
}
