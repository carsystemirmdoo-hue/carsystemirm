import Image from "next/image";
import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { Footer } from "@/components/layout/Footer";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { CarsystemHero } from "./CarsystemHero";
import { CarsystemMediaSlot } from "./CarsystemMediaSlot";
import { CarsystemPageShell } from "./CarsystemPageShell";
import { CarsystemProcess } from "./CarsystemProcess";
import { CarsystemProducts } from "./CarsystemProducts";
import { CarsystemUseCases } from "./CarsystemUseCases";
import {
  carsystemDocumentation,
  carsystemFamilies,
  carsystemFinalCta,
  carsystemMedia,
  carsystemMetrics,
  carsystemSectionNavItems,
  carsystemWorkflow,
  type CarsystemMediaAvailability,
} from "./carsystemBrandData";
import { getCarsystemMediaAvailability } from "./carsystemMedia.server";
import styles from "./CarsystemBrandPage.module.css";

export function CarsystemBrandPage({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const mediaAvailability = getCarsystemMediaAvailability();
  const productBySlug = new Map(
    products.map((product) => [product.slug, product]),
  );

  return (
    <CarsystemPageShell>
      <main>
        <CarsystemHero availability={mediaAvailability} />
        <BrandSectionNav
          ariaLabel="Brzi pristup Carsystem programu"
          items={[...carsystemSectionNavItems]}
        />
        <Metrics products={products} />
        <CarsystemProcess
          availability={mediaAvailability}
          products={products}
        />
        <WorkflowStory availability={mediaAvailability} />
        <Families productBySlug={productBySlug} />
        <CarsystemUseCases products={products} />
        <CarsystemProducts products={products} />
        <Documentation />
        <FinalCta productBySlug={productBySlug} />
      </main>
      <Footer />
    </CarsystemPageShell>
  );
}

function Metrics({ products }: { products: CarsystemProduct[] }) {
  const programCount = new Set(products.map((product) => product.programSlug))
    .size;

  function resolveValue(value: (typeof carsystemMetrics)[number]["value"]) {
    if (value === "catalog-count") {
      return String(products.length).padStart(2, "0");
    }
    if (value === "program-count") {
      return String(programCount).padStart(2, "0");
    }
    return value;
  }

  return (
    <section
      id="overview"
      className={styles.metrics}
      aria-label="Carsystem sistem u brojkama"
      data-cs-reveal
    >
      <div className={styles.metricsLine} aria-hidden="true">
        <i />
        <b />
        <i />
      </div>
      <dl>
        {carsystemMetrics.map((metric) => (
          <div key={metric.id}>
            <dt>
              <strong>{resolveValue(metric.value)}</strong>
              <span>{metric.label}</span>
            </dt>
            <dd>{metric.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function WorkflowStory({
  availability,
}: {
  availability: CarsystemMediaAvailability;
}) {
  return (
    <section
      className={`${styles.section} ${styles.workflowSection}`}
      aria-labelledby="carsystem-workflow-title"
      data-cs-reveal
    >
      <header className={styles.workflowHeader}>
        <p className={styles.sectionKicker}>Povezan rezultat</p>
        <h2 id="carsystem-workflow-title">{carsystemWorkflow.title}</h2>
        <p>{carsystemWorkflow.description}</p>
      </header>

      <div className={styles.workflowTrack}>
        <span className={styles.workflowLine} aria-hidden="true" />
        {carsystemWorkflow.stages.map((stage) => {
          const media = carsystemMedia[stage.mediaId];

          return (
            <article key={stage.title}>
              <CarsystemMediaSlot
                availability={availability[media.id]}
                className={styles.workflowMedia}
                media={media}
                sizes="(min-width: 64rem) 24vw, (min-width: 40rem) 45vw, 88vw"
              />
              <div>
                <span>{stage.index}</span>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Families({
  productBySlug,
}: {
  productBySlug: Map<string, CarsystemProduct>;
}) {
  return (
    <section
      id="systems"
      className={`${styles.section} ${styles.familiesSection}`}
      aria-labelledby="carsystem-families-title"
      data-cs-reveal
    >
      <header className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionKicker}>Potvrđene programske celine</p>
          <h2 id="carsystem-families-title">Sistemi koji nose radionicu</h2>
        </div>
        <p>
          Četiri celine zasnovane su isključivo na postojećim lokalnim product
          zapisima i mogu se širiti bez promene kompozicije.
        </p>
      </header>

      <div className={styles.familiesGrid}>
        {carsystemFamilies.map((family, index) => {
          const familyProducts = family.productSlugs
            .map((slug) => productBySlug.get(slug))
            .filter((product): product is CarsystemProduct => Boolean(product));

          return (
            <article
              className={styles.familyPanel}
              data-layout={family.layout}
              key={family.id}
            >
              <div className={styles.familyCopy}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{family.eyebrow}</p>
                <h3>{family.title}</h3>
                <strong>{family.description}</strong>
                <Link href={family.href}>
                  {family.ctaLabel}
                  <i aria-hidden="true">↗</i>
                </Link>
              </div>

              <div
                className={styles.familyVisual}
                data-product-count={familyProducts.length}
              >
                {familyProducts.map((product, productIndex) => {
                  const image =
                    product.productImage ?? product.galleryImages[0] ?? null;
                  const usesPlaceholder =
                    image?.src.includes("placeholder-product");

                  return (
                    <span
                      data-product-index={productIndex}
                      key={product.slug}
                    >
                      {image && !usesPlaceholder ? (
                        <Image
                          src={image.src}
                          alt={image.alt}
                          fill
                          sizes={
                            family.layout === "featured"
                              ? "(min-width: 64rem) 42vw, 80vw"
                              : "(min-width: 64rem) 24vw, 72vw"
                          }
                        />
                      ) : (
                        <Image
                          src="/brands/carsystem.svg"
                          alt=""
                          width={130}
                          height={58}
                          aria-hidden="true"
                        />
                      )}
                    </span>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Documentation() {
  return (
    <section
      id="documentation"
      className={styles.documentationSection}
      aria-labelledby="carsystem-documentation-title"
      data-cs-reveal
    >
      <div className={styles.documentationIntro}>
        <p className={styles.sectionKicker}>Dokumentacija i podrška</p>
        <h2 id="carsystem-documentation-title">
          {carsystemDocumentation.title}
        </h2>
        <p>{carsystemDocumentation.description}</p>
      </div>

      <div className={styles.documentationGrid}>
        {carsystemDocumentation.resources.map((resource, index) => (
          <article
            data-disabled={!("href" in resource) || undefined}
            key={resource.id}
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{resource.label}</h3>
              <p>{resource.description}</p>
            </div>
            <strong>{resource.status}</strong>
            {"href" in resource ? (
              <Link href={resource.href} aria-label={`${resource.label}: ${resource.status}`}>
                ↗
              </Link>
            ) : (
              <span className={styles.disabledResource} aria-label="Nije još dostupno">
                —
              </span>
            )}
          </article>
        ))}
      </div>

      <div className={styles.documentationActions}>
        {carsystemDocumentation.actions.map((action) => (
          <Link
            className={
              action.variant === "primary"
                ? styles.primaryButton
                : styles.darkSecondaryButton
            }
            href={action.href}
            key={action.href}
          >
            {action.label}
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FinalCta({
  productBySlug,
}: {
  productBySlug: Map<string, CarsystemProduct>;
}) {
  const visualProducts = [
    "carsystem-f23-brusni-diskovi",
    "carsystem-git-multi-green",
    "carsystem-finish-serija",
  ]
    .map((slug) => productBySlug.get(slug))
    .filter((product): product is CarsystemProduct => Boolean(product));

  return (
    <section
      className={styles.finalCta}
      aria-labelledby="carsystem-final-title"
      data-cs-reveal
    >
      <div className={styles.finalCtaCopy}>
        <span>END / START</span>
        <h2 id="carsystem-final-title">{carsystemFinalCta.title}</h2>
        <p>{carsystemFinalCta.description}</p>
        <div>
          <Link className={styles.primaryButton} href={carsystemFinalCta.primaryCta.href}>
            {carsystemFinalCta.primaryCta.label}
            <span aria-hidden="true">↗</span>
          </Link>
          <Link
            className={styles.secondaryButton}
            href={carsystemFinalCta.secondaryCta.href}
          >
            {carsystemFinalCta.secondaryCta.label}
          </Link>
        </div>
      </div>

      <div className={styles.finalCtaVisual} aria-hidden="true">
        <span className={styles.finalCtaLine} />
        {visualProducts.map((product, index) => {
          const image = product.productImage ?? product.galleryImages[0];
          if (!image) return null;

          return (
            <span data-index={index} key={product.slug}>
              <Image
                src={image.src}
                alt=""
                fill
                sizes="(min-width: 64rem) 16vw, 30vw"
              />
            </span>
          );
        })}
        <i />
      </div>
    </section>
  );
}
