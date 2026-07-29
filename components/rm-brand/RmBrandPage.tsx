import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { RmAtmosphereShell } from "@/components/rm-brand/RmAtmosphereShell";
import { RmCampaignStage } from "@/components/rm-brand/RmCampaignStage";
import { RmProductFamilies } from "@/components/rm-brand/RmProductFamilies";
import { RmProductImageSlot } from "@/components/rm-brand/RmProductImageSlot";
import { RmProductSystemGallery } from "@/components/rm-brand/RmProductSystemGallery";
import {
  rmAgilisBenefits,
  rmAgilisFeatureProductSlugs,
  rmCatalogHref,
  rmColorSystems,
  rmCompatibleBrands,
  rmEditorialAssets,
  rmGallerySystems,
  rmProcessSteps,
  rmQuickAccessItems,
  rmRefinityAreas,
  rmSeries,
} from "@/components/rm-brand/rmBrandData";
import type {
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  RefinishPhase,
  RmCategorySlug,
} from "@/lib/carsystem-data";
import styles from "./RmBrandPage.module.css";

export function RmBrandPage({
  products,
}: {
  brand: CarsystemBrand;
  phases: RefinishPhase[];
  products: CarsystemProduct[];
  programs: ProgramGroup[];
}) {
  return (
    <RmAtmosphereShell>
      <main>
        <RmCampaignStage />
        <RmQuickAccess />
        <RmProcessFlow products={products} />
        <RmProductSystemGallery products={products} />
        <RmAgilisFeature products={products} />
        <div
          className={styles.refinityTransitionZone}
          data-rm-atmosphere-zone="refinity"
        >
          <span className={styles.refinityTransitionGrid} aria-hidden="true" />
          <RmRefinitySection />
        </div>
        <RmProductSeries products={products} />
        <RmColorSystems products={products} />
        <RmCompatibleBrands />
        <RmProductFamilies products={products} />
        <RmEditorialProofs />
        <RmFinalCta />
      </main>
      <Footer />
    </RmAtmosphereShell>
  );
}

function RmQuickAccess() {
  return (
    <nav
      id="quick-access"
      className={styles.quickAccess}
      aria-label="Brzi pristup R-M proizvodima"
    >
      <div className={styles.quickAccessRail}>
        {rmQuickAccessItems.map((item) => (
          <Link
            href={item.href}
            data-dominant={item.dominant || undefined}
            key={item.label}
          >
            {item.label}
            <span aria-hidden="true">{item.dominant ? "↗" : "→"}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

function RmProcessFlow({ products }: { products: CarsystemProduct[] }) {
  return (
    <section
      className={`${styles.rmSection} ${styles.processSection}`}
      aria-labelledby="rm-process-title"
    >
      <div className={styles.processIntro}>
        <div className={styles.sectionHeading}>
          <p className={styles.rmKicker}>Jedan povezan radni tok</p>
          <h2 id="rm-process-title">Kompletan R-M proces</h2>
        </div>
        <p>
          Od pripreme podloge do završnog sjaja, svaki korak vodi direktno ka
          odgovarajućem delu R-M kataloga.
        </p>
      </div>

      <ol className={styles.processFlow}>
        {rmProcessSteps.map((step) => {
          const count = products.filter(
            (product) => product.phaseSlug === step.phase,
          ).length;

          return (
            <li key={step.number}>
              <span className={styles.processNumber}>{step.number}</span>
              <div className={styles.processCopy}>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
                <div className={styles.processTags} aria-label="Grupe proizvoda">
                  {step.productGroups.map((group) => (
                    <span key={group}>{group}</span>
                  ))}
                </div>
              </div>
              <div className={styles.processFooter}>
                <span>
                  {count} {productCountLabel(count)}
                </span>
                <Link href={step.href} aria-label={`${step.title}, otvorite katalog`}>
                  Otvorite fazu
                  <span aria-hidden="true">↗</span>
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function RmAgilisFeature({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const agilisProducts = rmAgilisFeatureProductSlugs
    .map((slug) => products.find((product) => product.slug === slug))
    .filter((product): product is CarsystemProduct => Boolean(product));
  const agilisSystem = rmGallerySystems.find((system) => system.id === "agilis");
  const agilisLineup = [
    ...agilisProducts.slice(0, 4).map((product) => ({
      asset: product.productImage,
      feature:
        product.rmMetadata?.technology?.replaceAll("-", " ").toUpperCase() ||
        "WATERBORNE",
      group: product.rmMetadata
        ? getRmCategoryLabel(product.rmMetadata.category)
        : "R-M proizvod",
      href: `/proizvodi/${product.slug}`,
      name: product.name,
    })),
    ...(agilisSystem?.slots ?? [])
      .slice(agilisProducts.length, 4)
      .map((slot) => ({
        asset: null,
        feature: slot.technology,
        group: slot.group,
        href: rmCatalogHref({ system: "agilis" }),
        name: slot.name,
      })),
  ].slice(0, 4);

  return (
    <section
      id="agilis"
      className={`${styles.rmSection} ${styles.agilisSection}`}
      aria-labelledby="agilis-title"
      data-rm-atmosphere-zone="agilis"
    >
      <div className={styles.agilisHeader}>
        <div>
          <p className={styles.rmKicker}>Ključni R-M sistem</p>
          <h2 id="agilis-title">AGILIS</h2>
        </div>
        <p>
          Vodena bazna linija nove generacije za radionice koje traže preciznu
          nijansu, stabilan rezultat i efikasniji proces.
        </p>
      </div>

      <div className={styles.agilisLayout}>
        <div className={styles.agilisBenefits}>
          {rmAgilisBenefits.map((benefit, index) => (
            <article key={benefit}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{benefit}</h3>
            </article>
          ))}
        </div>

        <div className={styles.agilisTechnicalVisual}>
          <Image
            className={styles.agilisEditorialImage}
            src={rmEditorialAssets.agilis.src}
            alt={rmEditorialAssets.agilis.alt}
            fill
            style={{ objectPosition: rmEditorialAssets.agilis.objectPosition }}
            sizes="(min-width: 70rem) 42vw, 92vw"
          />
          <span className={styles.agilisArc} aria-hidden="true" />
          <span className={styles.agilisSpectralLine} aria-hidden="true" />
          <div>
            <Image src="/brands/rm.svg" alt="R-M" width={176} height={78} />
            <strong>AGILIS</strong>
            <small>WATERBORNE BASECOAT SYSTEM</small>
          </div>
        </div>
      </div>

      <div
        className={styles.agilisProductGrid}
        aria-label="AGILIS sistemske komponente"
      >
        {agilisLineup.map((item) => (
          <RmProductImageSlot
            asset={item.asset}
            aspectRatio="4 / 5"
            feature={item.feature}
            group={item.group}
            href={item.href}
            key={item.name}
            productName={item.name}
            role={item.group}
            sizes="(min-width: 70rem) 18vw, (min-width: 48rem) 24vw, 84vw"
            system="AGILIS"
          />
        ))}
      </div>

      <div className={styles.agilisActions}>
        <p>
          Potvrđene fotografije prikazujemo iz kataloga, a ostale komponente
          ostaju jasni tehnički slotovi do odobrenja finalnih asseta.
        </p>
        <div>
          <Link
            className={styles.rmOutlineButton}
            href={rmCatalogHref({ system: "agilis" })}
          >
            Svi AGILIS proizvodi
            <span aria-hidden="true">↗</span>
          </Link>
          <Link
            className={styles.rmPrimaryButton}
            href="/kontakt?tema=proizvod&brend=rm&sistem=agilis"
          >
            Pošaljite upit
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </section>
  );
}

function RmRefinitySection() {
  const flow = ["Vozilo", "ScanR", "Refinity formula", "Automatsko mešanje", "Spremna boja"];

  return (
    <section
      id="refinity"
      className={styles.refinitySection}
      aria-labelledby="refinity-title"
    >
      <span className={styles.refinityAmbient} aria-hidden="true" />
      <span className={styles.refinitySignal} aria-hidden="true" />
      <div className={styles.refinityHeader}>
        <div>
          <p className={styles.rmKicker}>Digitalni koloristički tok</p>
          <h2 id="refinity-title">Refinity povezuje svaki korak do formule.</h2>
        </div>
        <p>
          Digitalni sistem za pronalaženje boje, formule, mešanje i organizaciju
          radionice. Refinity nije klasičan proizvod za kupovinu iz kataloga.
        </p>
      </div>

      <ol className={styles.refinityFlow} aria-label="Refinity tok">
        {flow.map((step, index) => (
          <li key={step}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>

      <figure id="refinity-editorial" className={styles.refinityEditorial}>
        <Image
          src={rmEditorialAssets.refinity.src}
          alt={rmEditorialAssets.refinity.alt}
          fill
          style={{ objectPosition: rmEditorialAssets.refinity.objectPosition }}
          sizes="(min-width: 70rem) 72vw, 94vw"
        />
        <figcaption>
          <span>REFINITY</span>
          <strong>Jedan povezani digitalni tok.</strong>
        </figcaption>
      </figure>

      <div id="refinity-tools" className={styles.refinityAreas}>
        {rmRefinityAreas.map((area, index) => (
          <article key={area}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            <h3>{area}</h3>
          </article>
        ))}
      </div>

      <div className={styles.refinityActions}>
        <Link className={styles.refinityPrimary} href="#refinity-tools">
          Saznajte više
          <span aria-hidden="true">↓</span>
        </Link>
        <Link
          className={styles.refinitySecondary}
          href="/kontakt?tema=podrska&brend=rm&oblast=refinity"
        >
          Razgovarajte sa našim timom
        </Link>
        <Link
          className={styles.refinityTextLink}
          href="/kontakt?tema=proizvod&brend=rm&oblast=koloristika"
        >
          R-M alati za koloristiku
          <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}

function RmProductSeries({ products }: { products: CarsystemProduct[] }) {
  return (
    <section
      id="rm-series"
      className={`${styles.rmSection} ${styles.seriesSection}`}
      aria-labelledby="rm-series-title"
    >
      <div className={styles.sectionHeading}>
        <p className={styles.rmKicker}>Procesne tehnologije</p>
        <h2 id="rm-series-title">Pioneer, Advance i Element</h2>
        <p>
          Tri serije pozicionirane prema nivou tehnologije, produktivnosti i
          svakodnevnim zahtevima radionice.
        </p>
      </div>

      <div className={styles.seriesLayout}>
        {rmSeries.map((series, index) => {
          const count = products.filter(
            (product) => product.rmMetadata?.series === series.series,
          ).length;
          const hasProducts = count > 0;

          return (
            <article
              id={series.series === "pioneer" ? "pioneer-series" : undefined}
              data-dominant={index === 0 || undefined}
              key={series.series}
            >
              <div>
                <p>R-M {series.label} Series</p>
                <span>{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3>{series.label}</h3>
              <p>{series.description}</p>
              <Link
                href={
                  hasProducts
                    ? rmCatalogHref({ series: series.series })
                    : `/kontakt?tema=proizvod&brend=rm&serija=${series.series}`
                }
              >
                {hasProducts
                  ? `Pogledajte ${count} ${productCountLabel(count)}`
                  : `Pošaljite upit za ${series.label}`}
                <span aria-hidden="true">↗</span>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RmColorSystems({ products }: { products: CarsystemProduct[] }) {
  return (
    <section
      className={`${styles.rmSection} ${styles.colorSystemsSection}`}
      aria-labelledby="color-systems-title"
    >
      <div className={styles.colorSystemsHeader}>
        <div className={styles.sectionHeading}>
          <p className={styles.rmKicker}>Procesne linije boja</p>
          <h2 id="color-systems-title">R-M sistemi za svaku vrstu procesa.</h2>
        </div>
        <p>
          Od vodene bazne linije do direktnog sjaja, specijalnih efekata i
          komercijalnih vozila, svaki sistem ima jasno mesto u radnom toku.
        </p>
      </div>

      <div className={styles.colorSystemsMosaic}>
        {rmColorSystems.map((system, index) => {
          const catalogSystemProducts = products.filter(
            (product) => product.rmMetadata?.system === system.system,
          );
          const systemProducts = system.productSlugs
            ? system.productSlugs
                .map((slug) => products.find((product) => product.slug === slug))
                .filter((product): product is CarsystemProduct => Boolean(product))
            : catalogSystemProducts;
          const count = catalogSystemProducts.length;
          const hasProducts = count > 0;
          const visualCount = index === 0 ? 4 : 3;
          const visualItems = Array.from({ length: visualCount }, (_, itemIndex) => {
            const product = systemProducts[itemIndex];
            const stage = system.stages[itemIndex % system.stages.length];
            const asset =
              product?.productImage?.src &&
              !product.productImage.src.endsWith("placeholder-product.svg")
                ? product.productImage
                : null;

            return {
              asset,
              label: product?.name ?? stage,
              product,
            };
          });

          return (
            <article
              data-dominant={index === 0 || undefined}
              data-system={system.system}
              key={system.system}
            >
              <header className={styles.systemCardHeader}>
                <span className={styles.systemIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p>{system.technology}</p>
              </header>

              <div className={styles.systemCardCopy}>
                <h3>{system.title}</h3>
                <p>{system.description}</p>
              </div>

              <ol
                className={styles.systemProcessPath}
                aria-label={`${system.title} proces`}
              >
                {system.stages.map((stage, stageIndex) => (
                  <li key={stage}>
                    <span>{String(stageIndex + 1).padStart(2, "0")}</span>
                    <strong>{stage}</strong>
                  </li>
                ))}
              </ol>

              <div
                className={styles.systemProductVisuals}
                aria-label={`${system.title} proizvodi i procesne grupe`}
              >
                {visualItems.map((item, itemIndex) => (
                  <figure key={`${item.label}-${itemIndex}`}>
                    <div>
                      {item.asset ? (
                        <Image
                          src={item.asset.src}
                          alt={item.asset.alt}
                          fill
                          sizes={
                            index === 0
                              ? "(min-width: 70rem) 10vw, 20vw"
                              : "(min-width: 70rem) 7vw, 18vw"
                          }
                        />
                      ) : (
                        <span className={styles.systemTechnicalSlot}>
                          <small>Procesna grupa</small>
                          <strong>{item.label}</strong>
                        </span>
                      )}
                    </div>
                    <figcaption>{item.label}</figcaption>
                  </figure>
                ))}
              </div>

              <footer className={styles.systemCardFooter}>
                <div>
                  <span>Ključna korist</span>
                  <strong>{system.benefit}</strong>
                </div>
                <Link
                  href={
                    hasProducts
                      ? rmCatalogHref({ system: system.system })
                      : `/kontakt?tema=proizvod&brend=rm&sistem=${system.system}`
                  }
                >
                  {hasProducts ? "Otvorite proizvode" : "Pošaljite upit"}
                  <span aria-hidden="true">↗</span>
                </Link>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RmCompatibleBrands() {
  const brandRows =
    rmCompatibleBrands.length >= 10
      ? [
          rmCompatibleBrands.filter((_, index) => index % 2 === 0),
          rmCompatibleBrands.filter((_, index) => index % 2 === 1),
        ]
      : [rmCompatibleBrands];

  return (
    <section
      id="rm-compatible-brands"
      className={styles.compatibleBrands}
      aria-labelledby="compatible-brands-title"
    >
      <div className={styles.compatibleBrandsHeader}>
        <p className={styles.rmKicker}>R-M COLOR COVERAGE</p>
        <h2 id="compatible-brands-title">
          Rešenja za širok spektar automobilskih marki.
        </h2>
        <p>
          R-M koloristički sistemi i baze formula podržavaju rad na različitim
          proizvođačima, modelima i završnim efektima.
        </p>
      </div>

      <div className={styles.compatibleBrandRows}>
        {brandRows.map((brands, rowIndex) => (
          <div
            className={styles.compatibleBrandViewport}
            data-reverse={rowIndex % 2 === 1 || undefined}
            key={`brand-row-${rowIndex}`}
          >
            <div className={styles.compatibleBrandTrack}>
              {[false, true].map((duplicate) => (
                <div
                  aria-hidden={duplicate || undefined}
                  className={styles.compatibleBrandGroup}
                  key={duplicate ? "duplicate" : "source"}
                >
                  {brands.map((brand) => (
                    <figure key={`${brand.id}-${duplicate ? "copy" : "source"}`}>
                      {brand.logo ? (
                        <Image
                          src={brand.logo}
                          alt={duplicate ? "" : brand.alt}
                          width={164}
                          height={62}
                        />
                      ) : (
                        <span className={styles.compatibleBrandSlot}>
                          {brand.name}
                        </span>
                      )}
                    </figure>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RmEditorialProofs() {
  return (
    <section
      className={`${styles.rmSection} ${styles.editorialProofs}`}
      aria-label="R-M eSense i partnerstvo"
    >
      <article id="esense" className={styles.esensePanel}>
        <div className={styles.editorialProofImage}>
          <Image
            src={rmEditorialAssets.esense.src}
            alt={rmEditorialAssets.esense.alt}
            fill
            style={{ objectPosition: rmEditorialAssets.esense.objectPosition }}
            sizes="(min-width: 70rem) 46vw, 92vw"
          />
        </div>
        <div>
          <p className={styles.rmKicker}>R-M eSENSE</p>
          <h2>Efikasniji proces sa manjim uticajem.</h2>
          <p>
            Odabrane R-M procesne komponente razvijene su za kontrolisaniju
            potrošnju i savremeniji rad radionice.
          </p>
          <Link href={rmCatalogHref({ series: "pioneer" })}>
            Pogledajte R-M sisteme
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </article>

      <article id="rm-partnership" className={styles.partnershipPanel}>
        <div>
          <p className={styles.rmKicker}>R-M PARTNERSHIPS</p>
          <h2>Performanse potvrđene i izvan radionice.</h2>
          <p>
            R-M i Emil Frey Racing predstavljeni su zajedno u dostavljenom
            zvaničnom kampanjskom materijalu.
          </p>
        </div>
        <div className={styles.editorialProofImage}>
          <Image
            src={rmEditorialAssets.partnership.src}
            alt={rmEditorialAssets.partnership.alt}
            fill
            style={{
              objectPosition: rmEditorialAssets.partnership.objectPosition,
            }}
            sizes="(min-width: 70rem) 46vw, 92vw"
          />
        </div>
      </article>
    </section>
  );
}

function RmFinalCta() {
  return (
    <section
      id="rm-final-cta"
      className={styles.rmContactBand}
      aria-labelledby="rm-contact-title"
    >
      <div className={styles.rmContactCopy}>
        <p className={styles.rmKicker}>R-M PROGRAM</p>
        <h2 id="rm-contact-title">Pronađite R-M sistem za svoj proces.</h2>
        <p>
          Pregledajte kompletan program boja, lakova, prajmera, kitova i
          pomoćnih proizvoda ili se obratite našem timu.
        </p>
      </div>
      <div className={styles.contactActions}>
        <Link className={styles.rmPrimaryButton} href={rmCatalogHref()}>
          Svi R-M proizvodi
          <span aria-hidden="true">↗</span>
        </Link>
        <Link
          className={styles.rmContactSecondary}
          href="/kontakt?tema=proizvod&brend=rm"
        >
          Pošaljite upit
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

function productCountLabel(count: number) {
  return count === 1 ? "proizvod" : "proizvoda";
}

function getRmCategoryLabel(category: RmCategorySlug) {
  const labels: Record<RmCategorySlug, string> = {
    additive: "Aditiv",
    basecoat: "Bazna boja",
    bodyfiller: "Kit",
    cleaner: "Čistač",
    clearcoat: "Bezbojni lak",
    hardener: "Učvršćivač",
    "polishing-compound": "Pasta za poliranje",
    "primer-filler": "Prajmer ili punilac",
    thinner: "Razređivač",
  };
  return labels[category];
}
