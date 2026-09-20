"use client";

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type {
  ProductBenefit,
  ProductDetailDocument,
  ProductProcessApplication,
  ProductProcessStage,
  ProductTechnicalFact,
  ProductTechnology,
} from "@/types/product-detail";
import { useOptionalProductVariant } from "@/components/product/ProductVariantProvider";
import styles from "./ProductDetailExperience.module.css";

type ProductInformationAccordionProps = {
  benefits: ProductBenefit[];
  benefitsDescription?: string;
  benefitsTitle?: string;
  documents: ProductDetailDocument[];
  process?: ProductProcessApplication;
  processStages: ProductProcessStage[];
  technicalFacts: ProductTechnicalFact[];
  technology?: ProductTechnology;
};

export function ProductInformationAccordion({
  benefits,
  benefitsDescription,
  benefitsTitle,
  documents: serverDocuments,
  process,
  processStages,
  technicalFacts,
  technology,
}: ProductInformationAccordionProps) {
  /*
   * Dokumentacija prati AKTIVNU varijantu.
   *
   * Bezbednosni list je vezan za pakovanje, pa se izborom pakovanja mora promeniti isto kao
   * šifra i slika. Prop sa servera ostaje pad za površine bez izbora varijante (jedan
   * proizvod bez porodice) i za varijantu čiji skup nije razrešen.
   */
  const variant = useOptionalProductVariant();
  const documents = variant?.activeVariant.documents ?? serverDocuments;
  const accordionId = useId();
  const [openSectionIds, setOpenSectionIds] = useState<string[]>([]);
  const toggleSection = (sectionId: string) => {
    setOpenSectionIds((current) =>
      current.includes(sectionId)
        ? current.filter((item) => item !== sectionId)
        : [...current, sectionId],
    );
  };
  const hasContent =
    Boolean(process && processStages.length > 0) ||
    benefits.length > 0 ||
    Boolean(technology) ||
    technicalFacts.length > 0 ||
    documents.length > 0;

  if (!hasContent) return null;

  return (
    <section className={styles.informationAccordion} aria-label="Detaljne informacije o proizvodu">
      {process && processStages.length > 0 ? (
        <AccordionItem
          baseId={accordionId}
          id="application"
          open={openSectionIds.includes("application")}
          onToggle={() => toggleSection("application")}
          title="Primena"
        >
          <div className={styles.accordionIntro}>
            <h3>{process.title}</h3>
            <p>{process.description}</p>
          </div>
          <ul className={styles.accordionProcessList} data-mode={process.mode}>
            {processStages.map((stage) => (
              <li key={stage.label}>
                <strong>{stage.label}</strong>
                {stage.detail ? <span>{stage.detail}</span> : null}
              </li>
            ))}
          </ul>
        </AccordionItem>
      ) : null}

      {benefits.length > 0 ? (
        <AccordionItem
          baseId={accordionId}
          id="benefits"
          open={openSectionIds.includes("benefits")}
          onToggle={() => toggleSection("benefits")}
          title="Prednosti"
        >
          {benefitsTitle || benefitsDescription ? (
            <div className={styles.accordionIntro}>
              {benefitsTitle ? <h3>{benefitsTitle}</h3> : null}
              {benefitsDescription ? <p>{benefitsDescription}</p> : null}
            </div>
          ) : null}
          <ul className={styles.accordionBenefitList}>
            {benefits.map((benefit) => (
              <li key={benefit.title}>
                <strong>{benefit.title}</strong>
                <span>{benefit.description}</span>
              </li>
            ))}
          </ul>
        </AccordionItem>
      ) : null}

      {technology ? (
        <AccordionItem
          baseId={accordionId}
          id="technology"
          open={openSectionIds.includes("technology")}
          onToggle={() => toggleSection("technology")}
          title="Tehnologija"
        >
          <div className={styles.accordionIntro}>
            {technology.kicker ? <small>{technology.kicker}</small> : null}
            <h3>{technology.title}</h3>
            <p>{technology.description}</p>
          </div>
          {technology.facts ? (
            <dl className={styles.accordionFactList}>
              {technology.facts
                .filter((fact) => fact.reviewStatus === "confirmed")
                .map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
        </AccordionItem>
      ) : null}

      {technicalFacts.length > 0 ? (
        <AccordionItem
          baseId={accordionId}
          id="technical-data"
          open={openSectionIds.includes("technical-data")}
          onToggle={() => toggleSection("technical-data")}
          title="Tehnički podaci"
        >
          <dl className={styles.accordionSpecList}>
            {technicalFacts.map((fact) => (
              <div key={`${fact.label}-${fact.value}`}>
                <dt>{fact.label}</dt>
                <dd>
                  <strong>{fact.value}</strong>
                  {fact.detail ? <span>{fact.detail}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </AccordionItem>
      ) : null}

      {documents.length > 0 ? (
        <AccordionItem
          baseId={accordionId}
          id="documents"
          open={openSectionIds.includes("documents")}
          onToggle={() => toggleSection("documents")}
          title="Dokumentacija"
        >
          <ul className={styles.accordionDocumentList}>
            {documents.map((document) => {
              const metadata = [
                document.language,
                document.version,
                document.publishedAt,
              ]
                .filter(Boolean)
                .join(" · ");

              return (
                <li key={document.id}>
                  <span className={styles.accordionDocumentKind}>
                    {documentKindLabel[document.kind]}
                  </span>
                  <span className={styles.accordionDocumentCopy}>
                    <strong>{document.title}</strong>
                    {metadata || document.note ? (
                      <small>{metadata || document.note}</small>
                    ) : null}
                  </span>
                  {document.availability === "available" && document.href ? (
                    <a href={document.href} target="_blank" rel="noopener noreferrer">
                      Otvori PDF
                      <ArrowIcon />
                    </a>
                  ) : (
                    <span className={styles.accordionDocumentStatus}>U pripremi</span>
                  )}
                </li>
              );
            })}
          </ul>
        </AccordionItem>
      ) : null}
    </section>
  );
}

function AccordionItem({
  baseId,
  children,
  id,
  onToggle,
  open,
  title,
}: {
  baseId: string;
  children: ReactNode;
  id: string;
  onToggle: () => void;
  open: boolean;
  title: string;
}) {
  const buttonId = `${baseId}-${id}-button`;
  const panelId = `${baseId}-${id}-panel`;
  const panelRef = useRef<HTMLDivElement>(null);
  const panelInnerRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);

  const measureReservedHeight = useCallback(() => {
    const nextHeight = Math.ceil(panelInnerRef.current?.scrollHeight ?? 0);

    // The custom property is written synchronously as well as through React
    // state. This guarantees a measured target before the first open frame,
    // including immediately after hydration or a development refresh.
    panelRef.current?.style.setProperty(
      "--accordion-panel-height",
      `${nextHeight}px`,
    );

    setReservedHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  }, []);

  useLayoutEffect(() => {
    const panelInner = panelInnerRef.current;

    if (!panelInner) return;

    measureReservedHeight();

    if (typeof ResizeObserver === "undefined") return;

    const resizeObserver = new ResizeObserver(measureReservedHeight);
    resizeObserver.observe(panelInner);

    return () => resizeObserver.disconnect();
  }, [measureReservedHeight]);

  const handleToggle = () => {
    // Refresh the reserved slot in the same event as the state update. React
    // batches both values, so the browser never paints an unmeasured open panel.
    measureReservedHeight();
    onToggle();
  };

  const panelStyle = {
    "--accordion-panel-height": `${reservedHeight}px`,
  } as CSSProperties;

  return (
    <div className={styles.accordionItem} data-open={open || undefined}>
      <button
        id={buttonId}
        className={styles.accordionButton}
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        onClick={handleToggle}
      >
        <span>{title}</span>
        <span className={styles.accordionToggle} aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="m4 6 4 4 4-4" />
          </svg>
        </span>
      </button>
      <div
        ref={panelRef}
        id={panelId}
        className={styles.accordionPanel}
        data-open={open}
        role="region"
        aria-hidden={!open}
        aria-labelledby={buttonId}
        inert={!open}
        style={panelStyle}
      >
        <div ref={panelInnerRef} className={styles.accordionPanelInner}>
          <div className={styles.accordionPanelContent}>
            {children}
            <span className={styles.accordionPhantomBuffer} aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  );
}

const documentKindLabel: Record<ProductDetailDocument["kind"], string> = {
  tds: "TDS",
  sds: "SDS",
  flyer: "Info",
  instructions: "Uputstvo",
  other: "Dokument",
};

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}
