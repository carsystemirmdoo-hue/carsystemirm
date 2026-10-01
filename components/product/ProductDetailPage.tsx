import Link from "next/link";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { Footer } from "@/components/layout/Footer";
import { ProductIdentity } from "@/components/product/ProductIdentity";
import { getProductTechnicalFacts } from "@/components/product/productTechnicalFactList";
import { getProductDocuments } from "@/components/product/productDocumentList";
import { ProductInformationAccordion } from "@/components/product/ProductInformationAccordion";
import { ProductInquiryLink } from "@/components/product/ProductInquiryLink";
import { ProductMobileCta } from "@/components/product/ProductMobileCta";
import { ProductStickyStage } from "@/components/product/ProductStickyStage";
import { ProductVariantOptions } from "@/components/product/ProductVariantOptions";
import { ProductVariantProvider } from "@/components/product/ProductVariantProvider";
import { ProductVisualSurface } from "@/components/product/ProductVisualSurface";
import { getProductStageFormat } from "@/components/product/productStageImages";
import {
  productVariantKey,
  toProductVariantViews,
} from "@/components/product/productVariantView";
import {
  getCarsystemBrandBySlug,
  getCarsystemProductBySlug,
  getProductVariantSelector,
  getProgramGroupBySlug,
  getRefinishPhaseBySlug,
  type CarsystemBrand,
  type CarsystemProduct,
  type ProgramGroup,
} from "@/lib/carsystem-data";
import { getFamilyForProduct, productCanonicalHref } from "@/lib/product-families";
import type {
  ProductRelationshipSection,
  ProductTechnicalFact,
} from "@/types/product-detail";
import type { SeoBreadcrumbItem } from "@/components/seo/SeoBreadcrumbs";
import styles from "./ProductDetailExperience.module.css";

type ProductDetailPageProps = {
  product: CarsystemProduct;
  brand: CarsystemBrand;
  program: ProgramGroup;
  compatibleProducts: CarsystemProduct[];
  similarProducts: CarsystemProduct[];
  breadcrumbItems: SeoBreadcrumbItem[];
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
  breadcrumbItems,
  variantSelectInPlace = false,
}: ProductDetailPageProps & { variantSelectInPlace?: boolean }) {
  const detail = isConfirmed(product.detail?.reviewStatus) ? product.detail : undefined;
  const phase = getRefinishPhaseBySlug(product.phaseSlug);
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
  const documents = getProductDocuments(product);
  const compatibleContent = isConfirmed(detail?.compatibleProducts?.reviewStatus)
    ? detail?.compatibleProducts?.content
    : undefined;
  const finalCta = detail?.finalCta ?? {
    title: "Treba Vam savet pri izboru proizvoda?",
    description:
      "Pošaljite nam osnovne podatke o poslu i pomoći ćemo Vam da proverite odgovarajući proizvod.",
    inquiryLabel: "Pošaljite upit",
    storeLabel: "Pronađite prodavnicu",
  };
  /*
   * Varijante, razrešene na serveru.
   *
   * Skup se izvodi iz SELEKTORA, ne iz porodice: tako red u selektoru i zapis u
   * kontekstu ne mogu da se raziđu ni za jednu varijantu. Upravo je to
   * razilaženje i bilo kvar — kartica se menjala, a naslov, šifra, slika i
   * grafit su ostajali na varijanti koju je izabrao server.
   *
   * Manifest metrika slika (~300 KB) ostaje na serveru; klijent dobija samo
   * nekoliko stringova po varijanti.
   */
  const family = getFamilyForProduct(product);
  const selectorProducts = (variantSelector?.variants ?? [])
    .map((variant) => (variant.slug ? getCarsystemProductBySlug(variant.slug) : null))
    .filter((entry): entry is CarsystemProduct => Boolean(entry));
  const variantProducts =
    selectorProducts.length > 0 ? selectorProducts : [product];
  /*
   * Varijante koje su REDOVI ovog proizvoda (tabela šifara: granulacije,
   * pakovanja, boje) nemaju svoj slug, pa iz njih ne nastaje nijedan proizvod.
   * Bez sopstvenog pogleda klik na takav red nije imao šta da izabere.
   */
  const rowVariants =
    selectorProducts.length > 0 ? [] : (variantSelector?.variants ?? []);
  const variantViews = toProductVariantViews(
    variantProducts,
    family?.slug ?? null,
    rowVariants,
  );
  const initialVariantKey = productVariantKey(product);

  /*
   * Format panela se računa JEDNOM, iz reprezentativne varijante, i ostaje
   * zaključan dok korisnik bira boje. Isti razlog zbog kog se ne menja ni po
   * slici u galeriji: pomeranje okvira pomerilo bi stranu pod korisnikom.
   */
  const stageFormat = getProductStageFormat(
    variantViews.find((view) => view.key === initialVariantKey)?.images ??
      variantViews[0]?.images ??
      [],
  );

  return (
    <ProductVariantProvider
      initialKey={initialVariantKey}
      variants={variantViews}
    >
    <div className={styles.pageShell}>
      <main className={styles.pageMain}>
        <ProductBreadcrumb items={breadcrumbItems} />

        <div className={styles.narrativeGrid}>
          <div className={styles.stickyRail}>
            <ProductStickyStage
              brandName={brand.name}
              stageFormat={stageFormat}
            />
          </div>

          <div className={styles.narrativeContent}>
            <section className={styles.hero} aria-labelledby="product-title">
              <div className={styles.heroCopy}>
                <div className={styles.heroTaxonomy}>
                  <Link href={brand.routes.landing}>{brand.name}</Link>
                  <span>{program.name}</span>
                  {phase ? <span>{phase.name}</span> : null}
                </div>

                <ProductIdentity
                  kicker={detail?.hero?.kicker}
                  lead={detail?.hero?.lead}
                  subtype={detail?.hero?.subtype}
                />

                {variantSelector ? (
                  <ProductVariantOptions
                    selectInPlace={variantSelectInPlace}
                    currentSlug={product.slug}
                    section={variantSelector}
                  />
                ) : null}

                <div className={styles.heroActions}>
                  <ProductInquiryLink
                    className={styles.primaryAction}
                    cursor="button"
                  >
                    Pošaljite upit
                    <ArrowIcon />
                  </ProductInquiryLink>
                  <Link
                    className={styles.secondaryAction}
                    href="/prodavnice"
                    data-cursor="button"
                  >
                    Pronađite prodavnicu
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
              <ProductInquiryLink className={styles.finalPrimaryAction}>
                {finalCta.inquiryLabel}
                <ArrowIcon />
              </ProductInquiryLink>
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
      <ProductMobileCta />
    </div>
    </ProductVariantProvider>
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

function ProductBreadcrumb({ items }: { items: SeoBreadcrumbItem[] }) {
  return (
    <nav className={styles.breadcrumb} aria-label="Putanja">
      <ol>
        {items.map((item, index) => {
          const isCurrent = index === items.length - 1;
          return (
            <li key={`${item.path}-${item.name}`} aria-current={isCurrent ? "page" : undefined}>
              {isCurrent ? item.name : <Link href={item.path}>{item.name}</Link>}
              {!isCurrent ? <span aria-hidden="true">/</span> : null}
            </li>
          );
        })}
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
          const href = productCanonicalHref(product);

          return (
            <article className="cs-product-motion-card" key={product.slug}>
              <Link
                className={styles.relationshipVisual}
                href={href}
                aria-label={`Pogledajte proizvod ${product.name}`}
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
                  Pogledajte detalje
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
  return getProductTechnicalFacts(product);
}


function ArrowIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" />
    </svg>
  );
}
