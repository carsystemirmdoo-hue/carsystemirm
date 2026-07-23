import Link from "next/link";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { Footer } from "@/components/layout/Footer";
import { ProductInformationAccordion } from "@/components/product/ProductInformationAccordion";
import { ProductMobileCta } from "@/components/product/ProductMobileCta";
import { ProductStickyStage } from "@/components/product/ProductStickyStage";
import { ProductVariantOptions } from "@/components/product/ProductVariantOptions";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import {
  getCarsystemBrandBySlug,
  getProductPublicStatus,
  getProductVariantSelector,
  getProgramGroupBySlug,
  getRefinishPhaseBySlug,
  publicProgramGroups,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
import type {
  ProductDetailDocument,
  ProductRelationshipSection,
  ProductTechnicalFact,
} from "@/types/product-detail";
import styles from "./ProductDetailExperience.module.css";

type ProductDetailPageProps = {
  product: CarsystemProduct;
  brand: CarsystemBrand;
  program: ProgramGroup;
  compatibleProducts: CarsystemProduct[];
  similarProducts: CarsystemProduct[];
};

function isConfirmed(status: string | undefined) {
  return status === "confirmed";
}

export function ProductDetailPage({
  product,
  brand,
  program,
  compatibleProducts,
  similarProducts,
}: ProductDetailPageProps) {
  const detail = isConfirmed(product.detail?.reviewStatus) ? product.detail : undefined;
  const phase = getRefinishPhaseBySlug(product.phaseSlug);
  const publicStatus = getProductPublicStatus(product);
  const quickFacts = isConfirmed(detail?.quickFacts?.reviewStatus)
    ? detail?.quickFacts?.content.filter((item) => isConfirmed(item.reviewStatus)) ?? []
    : [];
  const variantSelector = getProductVariantSelector(product);
  const benefits = isConfirmed(detail?.benefits?.reviewStatus)
    ? detail?.benefits?.content.items.filter((item) => isConfirmed(item.reviewStatus)) ?? []
    : [];
  const process = isConfirmed(detail?.process?.reviewStatus)
    ? detail?.process?.content
    : undefined;
  const processStages =
    process?.stages.filter((stage) => isConfirmed(stage.reviewStatus)) ?? [];
  const technology = isConfirmed(detail?.technology?.reviewStatus)
    ? detail?.technology?.content
    : undefined;
  const technicalFacts = getTechnicalFacts(product);
  const documents = getDocuments(product);
  const compatibleContent = isConfirmed(detail?.compatibleProducts?.reviewStatus)
    ? detail?.compatibleProducts?.content
    : undefined;
  const finalCta = detail?.finalCta ?? {
    title: "Treba vam savet pri izboru proizvoda?",
    description:
      "Pošaljite nam osnovne podatke o poslu i pomoći ćemo vam da proverite odgovarajući proizvod.",
    inquiryLabel: "Pošalji upit",
    storeLabel: "Pronađi prodavnicu",
  };
  const inquiryHref = `/kontakt?tema=proizvod&proizvod=${product.slug}`;

  return (
    <div className={styles.pageShell}>
      <main className={styles.pageMain}>
        <ProductBreadcrumb product={product} brand={brand} program={program} />

        <div className={styles.narrativeGrid}>
          <div className={styles.stickyRail}>
            <ProductStickyStage product={product} brandName={brand.name} />
          </div>

          <div className={styles.narrativeContent}>
            <section className={styles.hero} aria-labelledby="product-title">
              <div className={styles.heroCopy}>
                <div className={styles.heroTaxonomy}>
                  <Link href={brand.routes.landing}>{brand.name}</Link>
                  <span>{program.name}</span>
                  {phase ? <span>{phase.name}</span> : null}
                </div>

                {detail?.hero?.kicker ? (
                  <p className={styles.heroKicker}>{detail.hero.kicker}</p>
                ) : null}
                <h1 id="product-title" className={styles.heroTitle} data-cursor="headline">
                  {product.name}
                </h1>
                {detail?.hero?.subtype ? (
                  <p className={styles.heroSubtype}>{detail.hero.subtype}</p>
                ) : null}
                <p className={styles.heroLead} data-cursor="text">
                  {detail?.hero?.lead ?? product.shortDescription}
                </p>

                <div className={styles.heroReference}>
                  {product.sku ? (
                    <span>
                      <small>Šifre artikala</small>
                      <strong>{product.sku}</strong>
                    </span>
                  ) : null}
                  <span>
                    <small>Status</small>
                    <strong className={styles.statusValue}>{publicStatus}</strong>
                  </span>
                </div>

                {variantSelector ? (
                  <ProductVariantOptions
                    currentSlug={product.slug}
                    inquiryHref={inquiryHref}
                    section={variantSelector}
                  />
                ) : null}

                <div className={styles.heroActions}>
                  <Link
                    className={styles.primaryAction}
                    href={inquiryHref}
                    data-cursor="button"
                  >
                    Pošalji upit
                    <ArrowIcon />
                  </Link>
                  <Link
                    className={styles.secondaryAction}
                    href="/prodavnice"
                    data-cursor="button"
                  >
                    Pronađi prodavnicu
                  </Link>
                </div>

                <p className={styles.heroNotice}>
                  Javne B2B cene nisu prikazane. Dostupnost i komercijalni uslovi
                  proveravaju se kroz upit.
                </p>
              </div>
            </section>

            {quickFacts.length >= 2 ? (
              <section className={styles.quickFacts} aria-label="Ključne činjenice">
                {quickFacts.map((fact) => (
                  <div className={styles.quickFact} key={`${fact.label}-${fact.value}`}>
                    <span>{fact.label}</span>
                    <strong>{fact.value}</strong>
                  </div>
                ))}
              </section>
            ) : null}

            <ProductInformationAccordion
              benefits={benefits}
              benefitsDescription={detail?.benefits?.content.description}
              benefitsTitle={detail?.benefits?.content.title}
              documents={documents}
              process={process}
              processStages={processStages}
              technicalFacts={technicalFacts}
              technology={technology}
            />

          </div>
        </div>

        <div className={styles.fullWidthContinuation}>
          <ProductJoinedRecommendations products={similarProducts} />

          <ProductRelationships
            content={compatibleContent}
            products={compatibleProducts}
            id="product-compatible-title"
            fallbackTitle="Kompatibilni proizvodi"
          />

          <section className={styles.finalCta} aria-labelledby="product-final-cta-title">
            <div>
              <p>Savet pre izbora</p>
              <h2 id="product-final-cta-title">{finalCta.title}</h2>
              <span>{finalCta.description}</span>
            </div>
            <div className={styles.finalCtaActions}>
              <Link className={styles.finalPrimaryAction} href={inquiryHref}>
                {finalCta.inquiryLabel}
                <ArrowIcon />
              </Link>
              {finalCta.storeLabel ? (
                <Link className={styles.finalSecondaryAction} href="/prodavnice">
                  {finalCta.storeLabel}
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </main>

      <Footer />
      <ProductMobileCta product={product} />
    </div>
  );
}

function ProductJoinedRecommendations({
  products,
}: {
  products: CarsystemProduct[];
}) {
  if (products.length === 0) return null;

  return (
    <section className={styles.joinedProductsSection} aria-labelledby="similar-products-title">
      <SectionHeading
        title="Slični proizvodi"
        description="Pogledajte druge proizvode iz iste kategorije i slične namene."
        id="similar-products-title"
      />
      <div
        className={styles.joinedProductRow}
        data-product-count={Math.min(products.length, 6)}
        aria-label="Slični proizvodi"
      >
        {products.map((product) => {
          const relationBrand = getCarsystemBrandBySlug(product.brandSlug);
          const relationProgram = getProgramGroupBySlug(product.programSlug);
          const relationPhase = getRefinishPhaseBySlug(product.phaseSlug);
          if (!relationBrand || !relationProgram || !relationPhase) return null;

          return (
            <CatalogProductCard
              brand={relationBrand}
              className={styles.joinedProductCard}
              contextLabel={`${relationProgram.shortName} · ${relationPhase.name}`}
              phase={relationPhase}
              product={product}
              program={relationProgram}
              variant="joined-row"
              key={product.slug}
            />
          );
        })}
      </div>
    </section>
  );
}

function ProductBreadcrumb({
  product,
  brand,
  program,
}: {
  product: CarsystemProduct;
  brand: CarsystemBrand;
  program: ProgramGroup;
}) {
  const publicProgram = publicProgramGroups.find((item) =>
    item.internalProgramSlugs.includes(program.slug),
  );
  const items = [
    { href: "/", label: "Početna" },
    { href: "/katalog", label: "Katalog" },
    {
      href: `/program/${publicProgram?.slug ?? program.slug}`,
      label: publicProgram?.name ?? program.name,
    },
    { href: brand.routes.landing, label: brand.name },
  ];

  return (
    <nav className={styles.breadcrumb} aria-label="Putanja">
      <ol>
        {items.map((item) => (
          <li key={item.href}>
            <Link href={item.href}>{item.label}</Link>
            <span aria-hidden="true">/</span>
          </li>
        ))}
        <li aria-current="page">{product.name}</li>
      </ol>
    </nav>
  );
}

function SectionHeading({
  description,
  id,
  inverse = false,
  title,
}: {
  description?: string;
  id: string;
  inverse?: boolean;
  title: string;
}) {
  return (
    <div className={styles.sectionHeading} data-inverse={inverse || undefined}>
      <div>
        <h2 id={id}>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
    </div>
  );
}

function ProductRelationships({
  content,
  fallbackTitle,
  id,
  products,
}: {
  content?: ProductRelationshipSection;
  fallbackTitle: string;
  id: string;
  products: CarsystemProduct[];
}) {
  if (products.length === 0) return null;

  return (
    <section className={styles.section} aria-labelledby={id}>
      <SectionHeading
        title={content?.title ?? fallbackTitle}
        description={content?.description}
        id={id}
      />
      <div className={styles.relationshipGrid}>
        {products.map((product) => {
          const relationBrand = getCarsystemBrandBySlug(product.brandSlug);
          const relationProgram = getProgramGroupBySlug(product.programSlug);
          const relationPhase = getRefinishPhaseBySlug(product.phaseSlug);
          const href = `/proizvodi/${product.slug}`;

          return (
            <article className="cs-product-motion-card" key={product.slug}>
              <Link
                className={styles.relationshipVisual}
                href={href}
                aria-label={`Pogledaj proizvod ${product.name}`}
                data-cursor="image"
                data-motion-surface
                data-product-card-motion
              >
                <ProductVisualSurface
                  brandName={relationBrand?.name ?? "Carsystem"}
                  product={product}
                  sizes="(min-width: 1120px) 28vw, (min-width: 720px) 44vw, 92vw"
                />
              </Link>
              <div className={styles.relationshipCopy}>
                <p>
                  {[relationBrand?.name, relationProgram?.shortName, relationPhase?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <h3>
                  <Link href={href}>{product.name}</Link>
                </h3>
                <span>{product.shortDescription}</span>
                <Link className={styles.relationshipLink} href={href}>
                  Pogledaj detalje
                  <ArrowIcon />
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function getTechnicalFacts(product: CarsystemProduct): ProductTechnicalFact[] {
  const reviewedFacts = product.detail?.technicalFacts;
  if (product.detail) {
    return isConfirmed(reviewedFacts?.reviewStatus)
      ? reviewedFacts?.content.filter((fact) => isConfirmed(fact.reviewStatus)) ?? []
      : [];
  }

  return product.specifications
    .filter((fact) => fact.label && fact.value)
    .map((fact) => ({ ...fact, reviewStatus: "confirmed" as const }));
}

function getDocuments(product: CarsystemProduct): ProductDetailDocument[] {
  const reviewedDocuments = product.detail?.documents;
  if (product.detail) {
    return isConfirmed(reviewedDocuments?.reviewStatus)
      ? reviewedDocuments?.content.filter(
          (document) =>
            isConfirmed(document.reviewStatus) &&
            (document.availability === "preparing" || Boolean(document.href)),
        ) ?? []
      : [];
  }

  return product.documents.flatMap((document, index) => {
    if (document.status === "placeholder") return [];
    if (document.status === "available" && !document.href) return [];

    return [
      {
        id: `${product.slug}-${index}`,
        title: document.title,
        kind: getLegacyDocumentKind(document.title),
        availability:
          document.status === "available" ? ("available" as const) : ("preparing" as const),
        href: document.status === "available" ? document.href : undefined,
        note: document.note,
        reviewStatus: "confirmed" as const,
      },
    ];
  });
}

function getLegacyDocumentKind(title: string): ProductDetailDocument["kind"] {
  const normalized = title.toLocaleLowerCase("sr-Latn");
  if (normalized.includes("tehnički")) return "tds";
  if (normalized.includes("bezbednosni")) return "sds";
  if (normalized.includes("uputstvo")) return "instructions";
  return "other";
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}
