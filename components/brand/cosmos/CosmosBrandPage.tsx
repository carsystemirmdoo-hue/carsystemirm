import Link from "next/link";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { Footer } from "@/components/layout/Footer";
import {
  type CarsystemBrand,
  type CarsystemProduct,
  programGroups,
  refinishPhases,
} from "@/lib/carsystem-data";
import {
  COSMOS_CATALOGUE_HREF,
  cosmosApplications,
  cosmosCounts,
  cosmosCuratedSlugs,
  cosmosFamilies,
  cosmosHeroCans,
  cosmosRangeSilhouettes,
} from "@/lib/cosmos-lac-brand-data";
import { getFeaturedDocuments } from "@/lib/documents";
import { CosmosApplicationFinder, type FinderProduct } from "./CosmosApplicationFinder";
import { CosmosBand } from "./CosmosBand";
import { CosmosFamilyRail } from "./CosmosFamilyRail";
import { CosmosHero } from "./CosmosHero";
import { CosmosRange } from "./CosmosRange";
import styles from "./CosmosBrandPage.module.css";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";
import { productCanonicalHref } from "@/lib/product-families";

type Props = {
  brand: CarsystemBrand;
  products: CarsystemProduct[];
};

/**
 * Bespoke COSMOS LAC brand page.
 *
 * Server component by default — every family name, count and product link is in
 * the server-rendered HTML. Only the hero, the rail and the application finder
 * are client components, each for one specific reason (scroll parallax, the
 * pinned rail, and selection state respectively).
 *
 * The page runs inside the standard global Carsystem shell: it renders no
 * header and no footer of its own.
 */
export function CosmosBrandPage({ brand, products }: Props) {
  const productBySlug = new Map(products.map((product) => [product.slug, product]));
  const programBySlug = new Map(programGroups.map((program) => [program.slug, program]));
  const phaseBySlug = new Map(refinishPhases.map((phase) => [phase.slug, phase]));

  const finderProducts: Record<string, FinderProduct> = {};
  for (const application of cosmosApplications) {
    for (const slug of application.productSlugs) {
      const product = productBySlug.get(slug);
      if (product?.productImage && !finderProducts[slug]) {
        finderProducts[slug] = {
          slug: product.slug,
          name: product.name,
          image: toDisplayImageSrc(product.productImage.src),
          imageAlt: product.productImage.alt,
          href: productCanonicalHref(product),
        };
      }
    }
  }

  const curated = cosmosCuratedSlugs
    .map((slug) => productBySlug.get(slug))
    .filter((product): product is CarsystemProduct => Boolean(product))
    .slice(0, 6);

  const featuredDocuments = getFeaturedDocuments("cosmos-lac");

  return (
    // `main` (ne `div`) jer je ovo jedini brand page koji nije imao main
    // landmark — svi ostali (Befar, Carfit, baslac, R-M, Norbin, Carsystem)
    // ga imaju. Element se menja, klasa i `data-brand-page` ostaju isti, pa
    // ni izgled ni sticky offset sistem nisu dirnuti.
    <main className={styles.page} data-brand-page="cosmos-lac">
      {/* 01 — hero */}
      <CosmosHero
        cans={cosmosHeroCans}
        familyCount={cosmosCounts.featuredFamilies}
        variantCount={cosmosCounts.variants}
      />

      {/* 02 — one pinned rail holding every featured family */}
      <CosmosFamilyRail
        catalogueHref={COSMOS_CATALOGUE_HREF}
        families={cosmosFamilies}
        otherLines={cosmosCounts.otherLines}
        otherVariants={cosmosCounts.otherVariants}
      />

      {/* 03 — band A: hinge after the rail releases */}
      <CosmosBand items={cosmosFamilies.map((family) => family.name)} />

      {/* 04 — range */}
      <CosmosRange
        lines={cosmosCounts.lines}
        productGroups={cosmosCounts.productGroups}
        silhouettes={cosmosRangeSilhouettes}
        variants={cosmosCounts.variants}
      />

      {/* band B — carries the dark to light inversion and pre-announces scene 05 */}
      <CosmosBand
        items={["Auto", "Metal", "Drvo", "Bicikl", "Dekor", "Art", "Radionica"]}
      />

      {/* 05 — application finder */}
      <CosmosApplicationFinder
        applications={cosmosApplications}
        productsBySlug={finderProducts}
      />

      {/*
        06 — commercial boundary. Full-bleed becomes an inset card: this is the
        point where the brand experience ends and Carsystem commerce begins.
      */}
      <section aria-labelledby="cosmos-commerce-title" className={styles.commerce}>
        <div className={styles.commerceCard}>
          <div className={styles.commerceHead}>
            <p className={styles.eyebrow}>COSMOS LAC u Carsystem i R-M programu</p>
            <h2 className={styles.display} id="cosmos-commerce-title">
              Dostupno iz našeg programa
            </h2>
            <p className={styles.body}>
              Izbor iz svake istaknute linije. Dostupnost i tačnu varijantu
              potvrđuje tehnička podrška.
            </p>
          </div>

          <div className={styles.commerceGrid}>
            {curated.map((product) => {
              const phase = phaseBySlug.get(product.phaseSlug);
              const program = programBySlug.get(product.programSlug);
              if (!phase || !program) return null;
              return (
                <CatalogProductCard
                  brand={brand}
                  key={product.slug}
                  phase={phase}
                  product={product}
                  program={program}
                />
              );
            })}
          </div>

          <div className={styles.commerceFoot}>
            <Link className={styles.commerceLink} href={COSMOS_CATALOGUE_HREF}>
              Svi COSMOS LAC proizvodi →
            </Link>
          </div>
        </div>
      </section>

      {/* 06.5 — official catalogue, if one exists */}
      {featuredDocuments.length > 0 ? (
        <section aria-labelledby="cosmos-documents-title" className={styles.documentsSection}>
          <div className={styles.documentsHead}>
            <p className={styles.eyebrow}>Katalozi</p>
            <h2 className={styles.display} id="cosmos-documents-title">
              Zvanični COSMOS LAC katalog
            </h2>
            <p className={styles.body}>
              Kompletan program u boji, na jednom mestu — RAL, Fast Acrylic, Easy Max,
              Spray.Bike, Chalk Effect, Flame i specijalni programi.
            </p>
          </div>
          <div className={styles.documentsGrid}>
            {featuredDocuments.map((document) => (
              <DocumentCard key={document.id} document={document} />
            ))}
          </div>
          <div className={styles.commerceFoot}>
            <Link className={styles.documentsLink} href="/katalozi?brand=cosmos-lac">
              Svi COSMOS LAC dokumenti →
            </Link>
          </div>
        </section>
      ) : null}

      {/* 07 — credibility: one verifiable fact about our own role, then stop */}
      <section aria-labelledby="cosmos-credibility-title" className={styles.credibility}>
        <p className={styles.eyebrow} id="cosmos-credibility-title">
          Zašto kod nas
        </p>
        <p className={styles.credibilityStatement}>
          COSMOS LAC program držimo na zalihama kroz Carsystem partnersku mrežu,
          uz tehničku podršku pri izboru nijanse i sistema.
        </p>
      </section>

      {/* 08 — the primary business objective */}
      <section aria-labelledby="cosmos-cta-title" className={styles.finalCta}>
        <p className={styles.eyebrow}>Partnerska mreža</p>
        <h2 className={styles.display} id="cosmos-cta-title">
          Pronađite najbližu prodavnicu
        </h2>
        <p className={styles.body}>
          Proverite dostupnost COSMOS LAC programa kod najbližeg partnera.
        </p>
        <div className={styles.heroCtas}>
          <Link className={styles.ctaPrimary} href="/prodavnice">
            Pronađite prodavnicu
            <span aria-hidden="true">→</span>
          </Link>
          <Link className={styles.ctaSecondary} href="/kontakt">
            Kontaktirajte tehničku podršku
          </Link>
        </div>
      </section>

      {/* Shared global Carsystem footer, rendered exactly as every other page
          component does it — the page shell supplies the header only. */}
      <Footer />
    </main>
  );
}
