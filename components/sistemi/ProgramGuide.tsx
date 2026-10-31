"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  jobImage,
  jobProducts,
  materialSummary,
  needsChoice,
  splitDetail,
  stepsFor,
  stepsLabel,
} from "@/lib/sistemi/guide";
import { sourceKey } from "@/lib/sistemi/keys";
import type {
  ResolvedGuide,
  ResolvedProduct,
  ResolvedSource,
  SistemiJob,
  SistemiScale,
  SistemiStep,
} from "@/lib/sistemi/types";
import { GuideLinks, ProductCards, ScaleView, SourceList } from "./SistemiParts";
import styles from "./Sistemi.styles";

export type GuideReferences = {
  products: Record<string, ResolvedProduct>;
  sources: Record<string, ResolvedSource>;
  guides: Record<string, ResolvedGuide>;
};

function PlaceholderIcon() {
  return (
    <svg aria-hidden="true" className={styles.productPlaceholder} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
      <rect height="16" rx="1.5" width="18" x="3" y="4" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </svg>
  );
}

function ProductChips({ slugs, products }: { slugs?: string[]; products: Record<string, ResolvedProduct> }) {
  const items = (slugs ?? []).map((slug) => products[slug]).filter((item): item is ResolvedProduct => Boolean(item));
  if (items.length === 0) return null;
  return (
    <ul aria-label="Proizvodi za ovaj korak" className={styles.productChips}>
      {items.map((product) => (
        <li key={product.slug}>
          <Link className={styles.productChip} href={product.href}>
            <span className={styles.productChipMedia}>
              {product.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- mala sličica; ista slika kao u katalogu
                <img alt="" decoding="async" height={32} loading="lazy" src={product.image.src} width={32} />
              ) : (
                <PlaceholderIcon />
              )}
            </span>
            <span>{product.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function StepRow({
  anchor,
  number,
  step,
  scale,
  choice,
  open,
  onToggle,
  references,
}: {
  anchor: string;
  number: number;
  step: SistemiStep;
  scale?: SistemiScale;
  choice?: string;
  open: boolean;
  onToggle: () => void;
  references: GuideReferences;
}) {
  const { conditions, why } = splitDetail(step.detail);
  const hasSources = Boolean(step.sources?.some((ref) => references.sources[sourceKey(ref)]));
  const hasDocs = Boolean(step.products?.some((slug) => references.products[slug]?.document));
  const parts = [why ? "Zašto" : "", scale ? "vrednosti" : "", hasSources ? "izvor" : "", hasDocs ? "listovi" : ""].filter(Boolean);
  const label = parts.join(", ").replace(/^./, (letter) => letter.toUpperCase());
  const bodyId = `${anchor}-detalji`;

  return (
    <li className={styles.gStep} id={anchor}>
      <span aria-hidden="true" className={styles.gStepNumber}>
        {number}
      </span>
      <div className={styles.gStepBody}>
        <h4 className={styles.gStepTitle}>{step.title}</h4>
        <p className={styles.gStepWhat}>{step.what}</p>
        {conditions.length ? (
          <p className={styles.gCondition}>
            <strong>Važno: </strong>
            {conditions.join(" ")}
          </p>
        ) : null}
        {step.material ? (
          <p className={styles.gStepMaterial}>
            <span>Materijal</span> {step.material}
          </p>
        ) : null}
        <ProductChips products={references.products} slugs={step.products} />
        {parts.length ? (
          <>
            <button aria-controls={bodyId} aria-expanded={open} className={styles.gDetailsToggle} onClick={onToggle} type="button">
              {label}
            </button>
            <div className={styles.gDetails} hidden={!open} id={bodyId}>
              {why ? <p>{why}</p> : null}
              {scale ? <ScaleView choice={choice} scale={scale} sources={references.sources} /> : null}
              {hasDocs ? <ProductCards products={references.products} slugs={step.products} /> : null}
              <SourceList refs={step.sources} sources={references.sources} />
            </div>
          </>
        ) : null}
        <GuideLinks guides={references.guides} slugs={step.guides} />
      </div>
    </li>
  );
}

/**
 * Vodič kroz posao: kartice poslova → samo potrebno pitanje → pregled postupka i materijala →
 * koraci (naziv, kratka instrukcija, uslovi; „zašto“, vrednosti i izvori na otvaranje).
 * Izbor je u adresi (`?posao=…&izbor=…`), pa se može podeliti i vratiti.
 */
export function ProgramGuide({
  jobs,
  scales,
  references,
  title,
  jobId,
  choice,
  onJob,
  onChoice,
}: {
  jobs: SistemiJob[];
  scales: Record<string, SistemiScale>;
  references: GuideReferences;
  title: string;
  jobId: string | undefined;
  choice: string | undefined;
  onJob: (id: string) => void;
  onChoice: (id: string) => void;
}) {
  const job = jobs.find((item) => item.id === jobId);
  const resultRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [scrollOnSelect, setScrollOnSelect] = useState(false);

  useEffect(() => {
    setOpen(new Set());
  }, [jobId, choice]);

  useEffect(() => {
    if (!scrollOnSelect || !resultRef.current) return;
    setScrollOnSelect(false);
    const top = resultRef.current.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.6) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      resultRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }
  }, [scrollOnSelect, jobId, choice]);

  const waiting = job ? needsChoice(job, choice) : false;
  const steps = job && !waiting ? stepsFor(job, choice) : [];
  const anchors = steps.map((step) => `korak-${job?.id}-${step.id}`);
  const option = job?.choice?.options.find((item) => item.id === choice);
  const materials = materialSummary(steps);
  const products = job && !waiting ? jobProducts(job, steps) : [];
  const shownInSteps = new Set(steps.flatMap((step) => step.products ?? []));
  const extraProducts = (job?.products ?? []).filter((slug) => !shownInSteps.has(slug));
  const allOpen = anchors.length > 0 && anchors.every((anchor) => open.has(anchor));

  // Slika kartice: prva slika proizvoda posla koju nije već uzela prethodna kartica.
  const used = new Set<string>();
  const cardImages = jobs.map((item) => {
    const image = jobImage(item, references.products, used);
    if (image) used.add(image.src);
    return image;
  });

  function select(id: string) {
    onJob(id);
    setScrollOnSelect(true);
  }

  return (
    <section aria-labelledby="poslovi-naslov" className={styles.section} id="poslovi">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Postupak</p>
        <h2 className={styles.sectionTitle} id="poslovi-naslov">
          {title}
        </h2>
      </div>

      <ul className={styles.jobCards}>
        {jobs.map((item, index) => {
          const image = cardImages[index];
          const count = stepsFor(item, item.choice?.options[0]?.id).length;
          return (
            <li key={item.id}>
              <button aria-pressed={item.id === jobId} className={styles.jobCard} onClick={() => select(item.id)} type="button">
                <span className={styles.jobCardMedia}>
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- slika proizvoda iz kataloga
                    <img alt="" decoding="async" height={88} loading="lazy" src={image.src} width={88} />
                  ) : (
                    <PlaceholderIcon />
                  )}
                </span>
                <span className={styles.jobCardText}>
                  <span className={styles.jobCardLabel}>{item.label ?? item.title}</span>
                  {item.desc ? <span className={styles.jobCardDesc}>{item.desc}</span> : null}
                  <span className={styles.jobCardMeta}>
                    {item.choice ? `oko ${stepsLabel(count)}` : stepsLabel(count)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {job ? (
        <div className={styles.guide} data-waiting={waiting ? "" : undefined} id="poslovi-rezultat" ref={resultRef}>
          <div className={styles.guideMain}>
            <div className={styles.guideHead}>
              <h3 className={styles.jobTitle}>{job.title}</h3>
              {job.lead ? <p className={styles.gLead}>{job.lead}</p> : null}
              <SourceList refs={job.sources} sources={references.sources} />
            </div>

            {job.choice ? (
              <fieldset className={styles.question} data-waiting={waiting ? "" : undefined}>
                <legend className={styles.questionLegend}>{job.choice.question ?? "Izaberite"}</legend>
                <div className={styles.questionOptions}>
                  {job.choice.options.map((item) => (
                    <label className={styles.questionOption} key={item.id}>
                      <input
                        checked={choice === item.id}
                        name={`izbor-${job.id}`}
                        onChange={() => {
                          onChoice(item.id);
                          if (waiting) setScrollOnSelect(true);
                        }}
                        type="radio"
                        value={item.id}
                      />
                      <span className={styles.questionLabel}>{item.label}</span>
                      {item.hint ? <span className={styles.questionHint}>{item.hint}</span> : null}
                    </label>
                  ))}
                </div>
                {option?.note ? <p className={styles.choiceNote}>{option.note}</p> : null}
              </fieldset>
            ) : null}

            {waiting ? null : (
              <>
                <div className={styles.gToolbar}>
                  <span>{stepsLabel(steps.length)}</span>
                  <button
                    className={styles.gToolbarButton}
                    onClick={() => setOpen(allOpen ? new Set() : new Set(anchors))}
                    type="button"
                  >
                    {allOpen ? "Zatvorite detalje" : "Otvorite sve detalje"}
                  </button>
                </div>
                <ol className={styles.gSteps}>
                  {steps.map((step, index) => {
                    const scaleId = step.scale === true ? job.id : typeof step.scale === "string" ? step.scale : undefined;
                    const anchor = anchors[index];
                    return (
                      <StepRow
                        anchor={anchor}
                        choice={choice}
                        key={step.id}
                        number={index + 1}
                        onToggle={() =>
                          setOpen((current) => {
                            const next = new Set(current);
                            if (next.has(anchor)) next.delete(anchor);
                            else next.add(anchor);
                            return next;
                          })
                        }
                        open={open.has(anchor)}
                        references={references}
                        scale={scaleId ? scales[scaleId] : undefined}
                        step={step}
                      />
                    );
                  })}
                </ol>
                {extraProducts.length ? (
                  <div className={styles.gExtra}>
                    <h4 className={styles.gAsideTitle}>Još uz ovaj posao</h4>
                    <ProductCards products={references.products} slugs={extraProducts} />
                  </div>
                ) : null}
                <GuideLinks guides={references.guides} slugs={job.guides} />
              </>
            )}
          </div>

          {waiting ? null : (
            <aside aria-label="Pregled posla" className={styles.guideAside}>
              <div className={styles.gAsideBlock}>
                <h4 className={styles.gAsideTitle}>Postupak</h4>
                <ol className={styles.gOverview}>
                  {steps.map((step, index) => (
                    <li key={step.id}>
                      <a href={`#${anchors[index]}`}>{step.title}</a>
                    </li>
                  ))}
                </ol>
              </div>
              {materials.length ? (
                <div className={styles.gAsideBlock}>
                  <h4 className={styles.gAsideTitle}>Potreban materijal</h4>
                  <ul className={styles.gMaterials}>
                    {materials.map((item) => (
                      <li key={item.text}>
                        {item.text}
                        <span className={styles.gMaterialSteps}>
                          {item.steps.length === 1 ? `korak ${item.steps[0]}` : `koraci ${item.steps.join(", ")}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {products.length ? (
                <div className={`${styles.gAsideBlock} ${styles.gAsideProductsBlock}`}>
                  <h4 className={styles.gAsideTitle}>Proizvodi ({products.length})</h4>
                  <ul className={styles.gAsideProducts}>
                    {products.map(({ slug, step }) => {
                      const product = references.products[slug];
                      if (!product) return null;
                      return (
                        <li key={slug}>
                          <Link href={product.href}>{product.name}</Link>
                          {step ? <span className={styles.gMaterialSteps}>korak {step}</span> : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <a className={styles.gAsideLink} href="#pitanje">
                Pitanje o ovom poslu
              </a>
            </aside>
          )}
        </div>
      ) : null}
    </section>
  );
}
