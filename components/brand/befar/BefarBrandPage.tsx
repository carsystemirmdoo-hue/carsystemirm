import Image from "next/image";
import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { Footer } from "@/components/layout/Footer";
import type { CarsystemBrand, CarsystemProduct } from "@/lib/carsystem-data";
import {
  befarCta,
  befarDiscoveryFamilies,
  befarDiscoveryGroups,
  befarDiscoveryMeta,
  befarFamilies,
  befarFamiliesMeta,
  befarFoamProfiles,
  befarGeometryMeta,
  befarHardnessSteps,
  befarHero,
  befarInUse,
  befarManufacturer,
  befarMaterialGroups,
  befarNav,
  befarObjectDetail,
  befarOpencell,
  befarOrbitalPerforation,
  befarPairingMeta,
  befarPerforations,
} from "@/lib/befar-brand-data";
import { BefarHardnessScale } from "./BefarHardnessScale";
import { BefarHeroObject } from "./BefarHeroObject";
import { BefarPairingDiagram } from "./BefarPairingDiagram";
import { BefarPerforationDisc } from "./BefarPerforationDisc";
import styles from "./BefarBrandPage.module.css";

/** Stabilna referenca — `BrandSectionNav` je drži u zavisnostima efekta. */
const befarSectionNavItems = befarNav.map((item) => ({
  href: `#${item.id}`,
  label: item.label,
  sectionId: item.id,
}));

type Props = {
  brand: CarsystemBrand;
  products: CarsystemProduct[];
};

export function BefarBrandPage({ brand, products }: Props) {
  /** Mapa naših objavljenih proizvoda po slugu — koristi je Product discovery. */
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  return (
    // `data-brand-page` uključuje stranicu u zajednički sistem sticky offseta —
    // `BrandSectionNav` na njega upisuje stvarnu visinu globalnog headera.
    <div className={styles.pageShell} data-brand-page>
      <main className={styles.main}>
        {/* ============================================================ 01 hero */}
        <section
          aria-labelledby="befar-hero-title"
          className={`${styles.hero} ${styles.anchor}`}
          id="objekat"
        >
          {/* Breadcrumb živi unutar hero površine. Poseban tamni bar odmah ispod
              globalnog headera čita se kao drugi header — to smo već imali. */}
          <nav aria-label="Putanja" className={styles.breadcrumb}>
            <div className={styles.container}>
              <ol>
                <li>
                  <Link href="/">Početna</Link>
                  <span aria-hidden="true">/</span>
                </li>
                <li>
                  <Link href="/brendovi">Brendovi</Link>
                  <span aria-hidden="true">/</span>
                </li>
                <li aria-current="page">{brand.name}</li>
              </ol>
            </div>
          </nav>

          <div className={`${styles.container} ${styles.heroInner}`}>
            {/* Samo šifra. Meta linija je uklonjena jer je na desktopu padala
                preko drugog reda lead pasusa — tekst preko teksta. Isti podatak
                stoji u sekciji tvrdoće, uz proizvod. */}
            <div className={styles.heroBackdrop} aria-hidden="true">
              <span className={styles.heroBackdropCode}>{befarHero.backdropCode}</span>
            </div>

            <div className={styles.heroCopy}>
              <Image
                alt={befarHero.logo.alt}
                className={styles.heroLogo}
                height={befarHero.logo.height}
                priority
                src={befarHero.logo.src}
                width={befarHero.logo.width}
              />
              <p className={styles.heroKicker}>{befarHero.kicker}</p>
              {/* Razmak posle svake linije osim zadnje — bez njega `textContent`
                  h1-a je „Preciznona tačkikontakta.“ i takav ide u pristupačno ime. */}
              <h1 className={styles.heroTitle} id="befar-hero-title">
                {befarHero.titleLines.map((line, index) => (
                  <span key={line}>
                    {line}
                    {index < befarHero.titleLines.length - 1 ? " " : ""}
                  </span>
                ))}
              </h1>
              <p className={styles.heroLead}>{befarHero.lead}</p>
              <a className={styles.heroCue} href="#tvrdoca">
                {befarHero.scrollCue}
                <span aria-hidden="true">↓</span>
              </a>
            </div>

            <BefarHeroObject />
          </div>
        </section>

        <BrandSectionNav ariaLabel="Befar sekcije" items={befarSectionNavItems} />

        {/* ======================================================= 02 materijal */}
        <section
          aria-labelledby="befar-material-title"
          className={`${styles.material} ${styles.anchor}`}
          id="materijal"
        >
          <div className={styles.container}>
            <p className={styles.sectionIndex}>
              <span>02</span> Šta Befar pravi
            </p>
            <h2 className={styles.sectionTitle} id="befar-material-title">
              Ne lak. Sloj koji lak dodiruje.
            </h2>
            <div className={styles.materialGrid}>
              {befarMaterialGroups.map((group) => (
                <article className={styles.materialCard} key={group.id}>
                  <div className={styles.materialMedia}>
                    <Image
                      alt={group.image.alt}
                      height={group.image.height}
                      sizes="(min-width: 64rem) 22vw, 44vw"
                      src={group.image.src}
                      width={group.image.width}
                    />
                  </div>
                  <h3 className={styles.materialLabel}>{group.label}</h3>
                  <p className={styles.materialBody}>{group.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================= 03 tvrdoća */}
        <BefarHardnessScale steps={befarHardnessSteps} />

        {/* ====================================================== 04 geometrija */}
        <section
          aria-labelledby="befar-geometry-title"
          className={`${styles.geometry} ${styles.anchor}`}
          id="geometrija"
        >
          <div className={styles.container}>
            <p className={styles.sectionIndex}>
              <span>04</span> Geometrija
            </p>
            <h2 className={styles.sectionTitle} id="befar-geometry-title">
              {befarGeometryMeta.title}
            </h2>
            <p className={styles.sectionLead}>{befarGeometryMeta.lead}</p>

            <div className={styles.perfGrid}>
              {befarPerforations.map((perforation) => (
                <article className={styles.perfCard} key={perforation.id}>
                  <p className={styles.perfNumber}>
                    {String(perforation.holes).padStart(2, "0")}
                  </p>
                  <BefarPerforationDisc
                    className={styles.perfDisc}
                    perforation={perforation}
                    titleId={`befar-perf-${perforation.id}`}
                  />
                  <h3 className={styles.perfLabel}>{perforation.label}</h3>
                  <p className={styles.perfPurpose}>{perforation.purpose}</p>
                  <ul className={styles.perfCodes}>
                    {perforation.codes.map((entry) => (
                      <li key={entry.code}>
                        <code className={styles.codeChip}>{entry.code}</code>
                        <span>{entry.label}</span>
                        {entry.stockEvidence === "recent-zero" ? (
                          <span className={styles.hardnessFlag}>po dogovoru</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className={styles.perfOrbital}>
              <p className={styles.perfOrbitalNumber}>16</p>
              <div>
                <h3 className={styles.perfLabel}>{befarOrbitalPerforation.label}</h3>
                <p className={styles.perfPurpose}>{befarOrbitalPerforation.purpose}</p>
                <ul className={styles.perfCodes}>
                  {befarOrbitalPerforation.codes.map((code) => (
                    <li key={code}>
                      <code className={styles.codeChip}>{code}</code>
                    </li>
                  ))}
                </ul>
              </div>
              <div className={styles.perfOrbitalMedia}>
                <Image
                  alt={befarGeometryMeta.anchorImage.alt}
                  height={befarGeometryMeta.anchorImage.height}
                  sizes="(min-width: 64rem) 32vw, 90vw"
                  src={befarGeometryMeta.anchorImage.src}
                  width={befarGeometryMeta.anchorImage.width}
                />
              </div>
            </div>

            <div className={styles.profiles}>
              <h3 className={styles.profilesTitle}>{befarGeometryMeta.profilesTitle}</h3>
              <ul className={styles.profilesList}>
                {befarFoamProfiles.map((profile) => (
                  <li key={profile.id}>
                    <FoamProfileGlyph id={profile.id} />
                    <p className={styles.profileLabel}>{profile.label}</p>
                    <p className={styles.profileBody}>{profile.body}</p>
                    <p className={styles.profileCodes}>{profile.codes}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ===================================================== 05 uparivanje */}
        <section
          aria-labelledby="befar-pairing-title"
          className={`${styles.pairing} ${styles.anchor}`}
          id="uparivanje"
        >
          <div className={styles.container}>
            <div className={styles.sectionHeaderInline}>
              <p className={styles.sectionIndex}>
                <span>05</span> Uparivanje
              </p>
              <h2 className={styles.sectionTitle} id="befar-pairing-title">
                {befarPairingMeta.title}
              </h2>
              <p className={styles.sectionLead}>{befarPairingMeta.lead}</p>
            </div>
            <BefarPairingDiagram />
            <p className={styles.pairingFootnote}>{befarPairingMeta.note}</p>
          </div>
        </section>

        {/* ======================================================= 06 porodice */}
        <section
          aria-labelledby="befar-families-title"
          className={`${styles.families} ${styles.anchor}`}
          id="porodice"
        >
          <div className={styles.container}>
            <p className={styles.sectionIndex}>
              <span>06</span> Porodice
            </p>
            <h2 className={styles.sectionTitle} id="befar-families-title">
              {befarFamiliesMeta.title}
            </h2>
            <p className={styles.sectionLead}>{befarFamiliesMeta.lead}</p>

            <div className={styles.familyGrid}>
              {befarFamilies.map((family) => (
                <article
                  className={styles.familyCard}
                  data-accent={family.accent ? "" : undefined}
                  data-weight={family.weight}
                  key={family.id}
                  style={
                    family.accent
                      ? ({ "--bf-family-accent": family.accent } as React.CSSProperties)
                      : undefined
                  }
                >
                  <div className={styles.familyMedia}>
                    <Image
                      alt={family.image.alt}
                      height={family.image.height}
                      sizes={
                        family.weight === "dominant"
                          ? "(min-width: 64rem) 52vw, 92vw"
                          : "(min-width: 64rem) 30vw, 92vw"
                      }
                      src={family.image.src}
                      width={family.image.width}
                    />
                  </div>
                  <div className={styles.familyBody}>
                    <p className={styles.familyKicker}>{family.kicker}</p>
                    {/* Leo je jedina podlinija sa potvrđenim logotipom i sopstvenom
                        bojom — dobija identitet unutar kartice, ne novu sekciju. */}
                    {family.logo ? (
                      <Image
                        alt={family.logo.alt}
                        className={styles.familyLogo}
                        height={family.logo.height}
                        sizes="120px"
                        src={family.logo.src}
                        width={family.logo.width}
                      />
                    ) : null}
                    <h3 className={styles.familyName}>{family.name}</h3>
                    <p className={styles.familyText}>{family.body}</p>
                    <dl className={styles.familySpecs}>
                      {family.specs.map((spec) => (
                        <div key={spec.label}>
                          <dt>{spec.label}</dt>
                          <dd>{spec.value}</dd>
                        </div>
                      ))}
                    </dl>
                    {family.catalogHref ? (
                      <Link className={styles.inlineLink} href={family.catalogHref}>
                        U katalogu
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ======================================================= 07 opencell */}
        <section
          aria-labelledby="befar-opencell-title"
          className={styles.opencell}
          id="opencell"
        >
          <div className={`${styles.container} ${styles.opencellInner}`}>
            <div className={styles.opencellCopy}>
              <p className={styles.sectionIndex}>
                <span>07</span> {befarOpencell.kicker}
              </p>
              {/* Bez zvaničnog vektorskog logotipa — neutralan tekstualni label,
                  namerno nestilizovan da ne imitira izgubljeni wordmark. */}
              <p className={styles.opencellLabel}>{befarOpencell.label}</p>
              <h2 className={styles.sectionTitle} id="befar-opencell-title">
                {befarOpencell.title}
              </h2>
              <p className={styles.sectionLead}>{befarOpencell.body}</p>

              <blockquote className={styles.opencellQuote}>
                <p lang="tr">{befarOpencell.claim.text}</p>
                <p className={styles.opencellQuoteTranslation}>
                  {befarOpencell.claim.translation}
                </p>
                <cite>{befarOpencell.claim.source}</cite>
              </blockquote>

              <ul className={styles.opencellScale}>
                {befarOpencell.scale.map((entry) => (
                  <li key={entry.colorName}>
                    <span
                      aria-hidden="true"
                      className={styles.opencellSwatch}
                      style={{ background: entry.swatch }}
                    />
                    <span className={styles.opencellScaleName}>{entry.colorName}</span>
                    <span className={styles.opencellScaleStars}>
                      {"★".repeat(entry.stars)}
                      <span className={styles.srOnly}>{` tvrdoća ${entry.stars} od 5`}</span>
                    </span>
                    <span className={styles.opencellScaleApply}>{entry.applyWith}</span>
                  </li>
                ))}
              </ul>

              <p className={styles.opencellDisclaimer}>{befarOpencell.disclaimer}</p>
              <Link className={styles.buttonSecondary} href={befarOpencell.cta.href}>
                {befarOpencell.cta.label}
              </Link>
            </div>

            <div className={styles.opencellMedia}>
              <Image
                alt={befarOpencell.image.alt}
                height={befarOpencell.image.height}
                sizes="(min-width: 64rem) 46vw, 92vw"
                src={befarOpencell.image.src}
                width={befarOpencell.image.width}
              />
            </div>
          </div>
        </section>

        {/* ========================================================= 08 detalj */}
        <section
          aria-labelledby="befar-detail-title"
          className={`${styles.detail} ${styles.anchor}`}
          id="detalj"
        >
          <h2 className={styles.srOnly} id="befar-detail-title">
            {befarObjectDetail.title}
          </h2>
          <div className={styles.detailStrip}>
            {befarObjectDetail.frames.map((frame) => (
              <figure className={styles.detailFrame} key={frame.id}>
                <Image
                  alt={frame.image.alt}
                  height={frame.image.height}
                  sizes="(min-width: 64rem) 46vw, 88vw"
                  src={frame.image.src}
                  width={frame.image.width}
                />
                <figcaption>{frame.caption}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* ========================================================== 09 u radu */}
        <section
          aria-labelledby="befar-inuse-title"
          className={`${styles.inUse} ${styles.anchor}`}
          id="u-radu"
        >
          <div className={styles.container}>
            <div className={styles.sectionHeaderInline}>
              <p className={styles.sectionIndex}>
                <span>09</span> U radu
              </p>
              <h2 className={styles.sectionTitle} id="befar-inuse-title">
                {befarInUse.title}
              </h2>
              <p className={styles.sectionLead}>{befarInUse.lead}</p>
            </div>

            <ol className={styles.useSteps}>
              {befarInUse.steps.map((step) => (
                <li key={step.id}>
                  <div className={styles.useMedia}>
                    <Image
                      alt={step.image.alt}
                      height={step.image.height}
                      sizes="(min-width: 64rem) 30vw, 92vw"
                      src={step.image.src}
                      width={step.image.width}
                    />
                  </div>
                  <p className={styles.useIndex}>{step.index}</p>
                  <h3 className={styles.useLabel}>{step.label}</h3>
                  <p className={styles.useBody}>{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ====================================================== 10 proizvodi */}
        <section
          aria-labelledby="befar-products-title"
          className={`${styles.discovery} ${styles.anchor}`}
          id="proizvodi"
        >
          <div className={styles.container}>
            <p className={styles.sectionIndex}>
              <span>10</span> Proizvodi
            </p>
            <h2 className={styles.sectionTitle} id="befar-products-title">
              {befarDiscoveryMeta.title}
            </h2>
            <p className={styles.sectionLead}>{befarDiscoveryMeta.lead}</p>

            {/* Kartica po boji, ne po SKU: prava fotografija postoji samo za
                porodicu 150 × 25 mm, a generički render ne sme predstavljati
                konkretan artikal druge dimenzije. */}
            <ul className={styles.productGrid}>
              {befarDiscoveryGroups.map((group) => {
                const available = group.variants.filter((variant) => bySlug.has(variant.slug));
                if (available.length === 0) return null;
                return (
                  <li className={styles.productCard} key={group.id}>
                    <div className={styles.productMedia}>
                      <Image
                        alt={group.image.alt}
                        height={group.image.height}
                        sizes="(min-width: 80rem) 22vw, (min-width: 48rem) 44vw, 88vw"
                        src={group.image.src}
                        width={group.image.width}
                      />
                    </div>
                    {/* Razmak je obavezan: bez njega `textContent` je
                        „Pena za poliranjeNarandžasta“ i tako ide u pristupačni tekst. */}
                    <p className={styles.productName}>
                      Pena za poliranje{" "}
                      <span>{group.colorName}</span>
                    </p>
                    <p className={styles.productRole}>{group.role}</p>
                    <ul className={styles.productVariants}>
                      {available.map((variant) => (
                        <li key={variant.slug}>
                          <Link href={`/proizvodi/${variant.slug}`}>
                            {variant.label}
                            <span aria-hidden="true">→</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>

            <div className={styles.discoveryFamilies}>
              <p className={styles.discoveryFamiliesLabel}>
                Ostale porodice u programu — vode u katalog
              </p>
              <ul>
                {befarDiscoveryFamilies.map((family) => (
                  <li key={family.label}>
                    <Link href={befarDiscoveryMeta.catalogHref}>
                      <span>{family.label}</span>
                      <span className={styles.discoveryFamilyDetail}>{family.detail}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <Link className={styles.buttonSecondary} href={befarDiscoveryMeta.catalogHref}>
              {befarDiscoveryMeta.catalogLabel}
            </Link>
          </div>
        </section>

        {/* ============================================= 11 proizvođač + CTA */}
        <section aria-labelledby="befar-manufacturer-title" className={styles.closing}>
          <div className={`${styles.container} ${styles.closingInner}`}>
            <div className={styles.manufacturer}>
              <p className={styles.sectionIndex}>
                <span>11</span> {befarManufacturer.title}
              </p>
              <h2 className={styles.sectionTitle} id="befar-manufacturer-title">
                Bursa, od 2002.
              </h2>
              <p className={styles.sectionLead}>{befarManufacturer.body}</p>

              <dl className={styles.manufacturerFacts}>
                {befarManufacturer.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <blockquote className={styles.manufacturerQuote}>
                <p lang="tr">{befarManufacturer.quote.text}</p>
                <p className={styles.opencellQuoteTranslation}>
                  {befarManufacturer.quote.translation}
                </p>
                <cite>{befarManufacturer.quote.source}</cite>
              </blockquote>

              <p className={styles.manufacturerDisclaimer}>{befarManufacturer.disclaimer}</p>
            </div>

            <div className={styles.cta}>
              <h3 className={styles.ctaTitle}>{befarCta.title}</h3>
              <div className={styles.ctaActions}>
                {befarCta.actions.map((action) => (
                  <Link
                    className={
                      action.tone === "primary"
                        ? styles.buttonPrimary
                        : action.tone === "secondary"
                          ? styles.buttonSecondary
                          : styles.inlineLink
                    }
                    href={action.href}
                    key={action.href}
                  >
                    {action.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/** Presek profila pene — lagani inline SVG, bez eksternog sprite-a. */
function FoamProfileGlyph({ id }: { id: string }) {
  const paths: Record<string, string> = {
    ravan: "M4 26 H60 V10 H4 Z",
    waffle:
      "M4 26 H60 V16 q-4 -6 -8 0 q-4 6 -8 0 q-4 -6 -8 0 q-4 6 -8 0 q-4 -6 -8 0 q-4 6 -8 0 Z",
    elips: "M4 26 H60 V10 H46 a5 5 0 0 1 -10 0 H28 a5 5 0 0 1 -10 0 H4 Z",
    konus: "M4 26 H60 L52 10 H12 Z",
    orbital: "M4 26 H60 V10 H4 Z M14 10 v16 M28 10 v16 M42 10 v16 M54 10 v16",
  };

  return (
    <svg
      aria-hidden="true"
      className={styles.profileGlyph}
      focusable="false"
      viewBox="0 0 64 30"
    >
      <path d={paths[id] ?? paths.ravan} />
    </svg>
  );
}
