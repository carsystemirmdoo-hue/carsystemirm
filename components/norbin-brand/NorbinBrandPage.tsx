import Image from "next/image";
import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { Footer } from "@/components/layout/Footer";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { NorbinGreyShade } from "./NorbinGreyShade";
import { NorbinTechTable } from "./NorbinTechTable";
import { NorbinProgramExplorer, type NorbinProgramItem } from "./NorbinProgramExplorer";
import { norbinTechnicalProducts, type NorbinDocument } from "./norbinTechnicalData";
import { NorbinRatioRow } from "./NorbinRatioRow";
import {
  norbinCodeFamilies,
  norbinFaq,
  norbinProcessSteps,
  norbinRatios,
  norbinSectionNavItems,
  norbinWhatItIs,
  norbinWhatItIsNot,
} from "./norbinBrandData";
import styles from "./NorbinBrandPage.module.css";
import { productCanonicalHref } from "@/lib/product-families";

export function NorbinBrandPage({
  products,
}: {
  products: CarsystemProduct[];
}) {
  const stockedProducts = products.filter(
    (product) => product.brandSlug === "norbin",
  );

  return (
    <div className={styles.norbinPage} data-brand-page>
      <main>
        <NorbinHero />
        <BrandSectionNav
          ariaLabel="Brzi pristup Norbin programu"
          items={norbinSectionNavItems}
        />
        <ProgramSection />
        <CodeSection />
        <OdnosSection />
        <ProcessSection />
        <GreyShadeSection />
        <OurProgramSection products={stockedProducts} />
        <TechnicalSection />
        <DocumentationSection />
        <OriginSection />
      </main>
      <Footer />
    </div>
  );
}

function NorbinHero() {
  return (
    <section className={styles.hero} aria-labelledby="norbin-hero-title">
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Putanja stranice">
          <Link href="/">Početna</Link>
          <span aria-hidden="true">/</span>
          <Link href="/brendovi">Brendovi</Link>
          <span aria-hidden="true">/</span>
          <strong>Norbin</strong>
        </nav>

        {/* Uvod (2026-10-20): tekst u svom pojasu, baner brenda ispod njega preko
            cele širine ekrana. Zaseban Norbin logo iznad naslova je uklonjen —
            ime brenda nose putanja, nadnaslov i prva rečenica. */}
        <div className={styles.heroGrid}>
          <div>
            <p className={styles.heroKicker}>Norbin · pomoćni program za lakirnicu</p>
            <h1 className={styles.heroTitle} id="norbin-hero-title">
              Kratak program koji radi u odnosima.
            </h1>
          </div>

          <div>
            <p className={styles.heroLead}>
              Norbin nije sistem boje — to ostaje Vaš postojeći izbor. Norbin
              je kratak, zatvoren program lakova, punilaca i učvršćivača koji
              rade isključivo u tačno propisanim parovima.
            </p>

            <div className={styles.heroFacts}>
              <div>
                <strong>13</strong>
                <span>proizvoda</span>
              </div>
              <div>
                <strong>5</strong>
                <span>odnosa mešanja</span>
              </div>
            </div>

            <div className={styles.heroActions}>
              <Link className={`${styles.buttonPrimary} cs-cta`} data-cta-on="theme" href="/prodavnice">
                Pronađite najbližu prodavnicu
              </Link>
              <Link className={`${styles.buttonSecondary} cs-cta`} data-cta-on="theme" href="/katalog?brend=norbin">
                Pogledajte Norbin proizvode
              </Link>
              <Link className={styles.buttonText} href="/kontakt?tema=proizvod&brend=norbin">
                Pošaljite upit →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Baner brenda (dostavio vlasnik 2026-10-19), od ivice do ivice. Na
          širokom ekranu ostaje skoro ceo kadar; isečak čuva čoveka, automobil i
          ukrštanje plave i žute trake. */}
      <div className={styles.heroBanner}>
        <Image
          src="/images/brands/norbin/hero/norbin-index-banner-1920-v1.jpg"
          alt="Norbin trake brenda i lakirer koji proverava završni sloj na vozilu"
          fill
          priority
          sizes="100vw"
        />
      </div>
    </section>
  );
}

function ProgramSection() {
  return (
    <section
      id="program"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-program-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Šta Norbin jeste, a šta nije</p>
        <h2 className={styles.sectionTitle} id="norbin-program-title">
          Pomoćni program, ne sistem boje.
        </h2>
        <p className={styles.sectionLead}>
          Norbin je deo Surventis refinish porodice (ranije BASF Coatings),
          pozicioniran uz Glasurit, R-M i baslac kao vrednosno pristupačan
          program.
        </p>

        <div className={styles.programGrid}>
          <div className={styles.programColumn}>
            <h3>Jeste</h3>
            <ul>
              {norbinWhatItIs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className={styles.programRule} aria-hidden="true" />
          <div className={`${styles.programColumn} ${styles.programNo}`}>
            <h3>Nije</h3>
            <ul>
              {norbinWhatItIsNot.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function CodeSection() {
  return (
    <section
      id="kod"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-code-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Kako se Norbin čita</p>
        <h2 className={styles.sectionTitle} id="norbin-code-title">
          Oznake N15, N55, N60, N75, N85, N95.
        </h2>
        <p className={styles.sectionLead}>
          Kada se zna da N15 znači bezbojni lak, a N75 učvršćivač, ostatak
          programa se sam dekodira.
        </p>

        <div className={styles.codeRow}>
          {norbinCodeFamilies.map((entry) => (
            <a className={styles.codeChip} href="#odnos" key={entry.prefix}>
              <strong>{entry.prefix}</strong>
              <span>{entry.family}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function OdnosSection() {
  return (
    <section
      id="odnos"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-odnos-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Odnos</p>
        <h2 className={styles.sectionTitle} id="norbin-odnos-title">
          Svaki proizvod ima tačno propisanog partnera.
        </h2>
        <p className={styles.sectionLead}>
          Pet odnosa mešanja pokriva ceo Norbin program — baza i
          učvršćivač uvek idu u tačno propisanoj razmeri, prema tehničkom
          listu.
        </p>

        <ol className={styles.ratioList} aria-label="Odnosi mešanja u Norbin programu">
          {norbinRatios.map((row) => (
            <NorbinRatioRow row={row} key={row.base} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function ProcessSection() {
  return (
    <section
      id="proces"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-process-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Proces</p>
        <h2 className={styles.sectionTitle} id="norbin-process-title">
          Norbin u procesu popravke.
        </h2>
        <p className={styles.sectionLead}>
          Boja ostaje Vaš sistem — Norbin tu namerno nema proizvod.
        </p>

        <div className={styles.processSpine}>
          {norbinProcessSteps.map((step) =>
            "empty" in step && step.empty ? (
              <div className={`${styles.processStep} ${styles.processStepEmpty}`} key={step.id}>
                <p>Vaš sistem boje</p>
              </div>
            ) : (
              <div className={styles.processStep} key={step.id}>
                <h3>{step.label}</h3>
                <p>{step.detail}</p>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function GreyShadeSection() {
  return (
    <section
      id="sivi-tonovi"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-grey-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Sivi tonovi</p>
        <h2 className={styles.sectionTitle} id="norbin-grey-title">
          N55-V20 i N55-V29, dve tačke jedne skale.
        </h2>
        <p className={styles.sectionLead}>
          Prema zvaničnom posteru sivih tonova, mešanje 50/50 po zapremini
          daje prelazni ton između tamno sivog N55-V20 i sivo-crnog N55-V29
          punioca. Boje na skali su ilustrativni prikaz, ne specifikacija.
        </p>

        <NorbinGreyShade />

        <div className={styles.heroActions} style={{ marginTop: "1.8rem" }}>
          <a
            className={styles.buttonText}
            href="https://www.norbin-paint.com/"
            target="_blank"
            rel="noreferrer"
          >
            Preuzmite tehnički poster →
          </a>
        </div>
      </div>
    </section>
  );
}

function OurProgramSection({ products }: { products: CarsystemProduct[] }) {
  const items: NorbinProgramItem[] = products.map((product) => {
    const image =
      product.productImage && !product.productImage.src.includes("placeholder-product")
        ? { src: product.productImage.src, alt: product.productImage.alt }
        : null;
    return {
      slug: product.slug,
      code: product.publicCode ?? product.sku,
      name: product.name,
      packages: (product.packages ?? []).map((pkg) => pkg.label).filter(Boolean),
      href: productCanonicalHref(product),
      image,
    };
  });

  return (
    <section
      id="nas-program"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-our-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Naš Norbin program</p>
        <h2 className={styles.sectionTitle} id="norbin-our-title">
          Šta zaista možete poručiti kod nas.
        </h2>
        <p className={styles.sectionLead}>
          Pređite mišem, tasterom Tab ili dodirom preko reda — desno je
          pregled proizvoda sa šifrom, pakovanjem i vezom.
        </p>

        <NorbinProgramExplorer items={items} />
      </div>
    </section>
  );
}

const TECH_FIELDS = [
  "Odnos mešanja",
  "Učvršćivač",
  "Razređivač",
  "Vreme upotrebe (20 °C)",
  "Broj slojeva",
  "Debljina suvog filma",
  "Sušenje 20 °C",
  "Sušenje 60 °C",
  "Brušenje",
  "VOC",
] as const;

function TechnicalSection() {
  // Pune tehničke listove imaju lakovi, punila, prajmer i kit; ostali imaju kratke listove.
  const detailed = norbinTechnicalProducts.filter((product) =>
    product.rows.some((row) => row.label === "Odnos mešanja"),
  );
  const shortSheets = norbinTechnicalProducts.filter((product) => !detailed.includes(product));
  const fields = TECH_FIELDS.filter((field) =>
    detailed.some((product) => product.rows.some((row) => row.label === field)),
  );

  return (
    <section
      id="tehnicki-podaci"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-tech-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Tehnički podaci</p>
        <h2 className={styles.sectionTitle} id="norbin-tech-title">
          Podaci iz tehničkih listova proizvođača.
        </h2>
        <p className={styles.sectionLead}>
          Vrednosti su prepisane iz aktuelnih tehničkih listova sa
          norbin-paint.com; polje koje list ne navodi ostaje prazno (—).
          Postupak uvek potvrdite u listu za tačan proizvod.
        </p>

        <NorbinTechTable
          fields={fields}
          columns={detailed.map((product) => ({
            code: product.code,
            name: product.name.replace(/^NORBIN\s+/i, ""),
            values: Object.fromEntries(
              [...product.rows].reverse().map((row) => [row.label, row.value]),
            ),
            tds: product.tds ? { url: product.tds.url, version: product.tds.version ?? null } : null,
          }))}
        />

        <p className={styles.techNoData}>
          Za učvršćivače, razređivač i silikon-čistač (
          {shortSheets.map((product) => product.code).join(", ")}) proizvođač
          objavljuje samo kratke listove na turskom jeziku, sa namenom,
          uslovima skladištenja i rokom trajanja; odnos mešanja je u listu
          proizvoda sa kojim se mešaju (odeljak Odnos, iznad).
        </p>
      </div>
    </section>
  );
}

function DocumentLink({ label, document }: { label: string; document: NorbinDocument | null }) {
  if (!document) {
    return (
      <span className={styles.docMissing}>
        Nije dostupan ·{" "}
        <Link href="/kontakt?tema=dokumentacija&brend=norbin">upit</Link>
      </span>
    );
  }
  return (
    <a className={styles.docLink} href={document.url} target="_blank" rel="noopener noreferrer">
      <span>{label} ↗</span>
      <small>
        {document.language}
        {document.version ? ` · ${document.version}` : ""}
      </small>
    </a>
  );
}

function DocumentationSection() {
  return (
    <section
      id="dokumentacija"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-docs-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Dokumentacija</p>
        <h2 className={styles.sectionTitle} id="norbin-docs-title">
          Tehnički i bezbednosni listovi.
        </h2>
        <p className={styles.sectionLead}>
          Svaki link vodi na PDF proizvođača za tačan proizvod. Dokumenti na
          srpskom jeziku nisu objavljeni.
        </p>

        <div className={styles.docTableWrap}>
          <table className={styles.docTable}>
            <thead>
              <tr>
                <th scope="col">Proizvod</th>
                <th scope="col">Tehnički list</th>
                <th scope="col">Bezbednosni list</th>
              </tr>
            </thead>
            <tbody>
              {norbinTechnicalProducts.map((product) => (
                <tr key={product.code}>
                  <th scope="row">
                    <strong>{product.code}</strong>
                    <span>{product.name.replace(/^NORBIN\s+/i, "")}</span>
                  </th>
                  <td data-label="Tehnički list">
                    <DocumentLink label="Tehnički list" document={product.tds} />
                  </td>
                  <td data-label="Bezbednosni list">
                    <DocumentLink label="Bezbednosni list" document={product.sds} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function OriginSection() {
  return (
    <section
      id="poreklo"
      className={`${styles.originSection} ${styles.anchor}`}
      aria-labelledby="norbin-origin-title"
    >
      <div className={styles.container}>
        <div className={styles.originGrid}>
          <div>
            <p className={styles.sectionKicker}>Poreklo</p>
            <h2 className={styles.sectionTitle} id="norbin-origin-title">
              Deo Surventis refinish porodice.
            </h2>
            <p>
              Norbin je lansiran 2015. i razvijen u okviru onoga što je danas
              Surventis (ranije BASF Coatings) — pakovanje i dalje nosi oznaku
              „A brand of BASF&rdquo;. Vrednosno je pozicioniran uz Glasurit, R-M i
              baslac.
            </p>

            <div className={styles.heroActions}>
              <Link className={`${styles.buttonPrimary} cs-cta`} data-cta-on="dark" href="/prodavnice">
                Pronađite najbližu prodavnicu
              </Link>
              <Link className={styles.buttonText} href="/kontakt?tema=proizvod&brend=norbin">
                Pošaljite upit →
              </Link>
            </div>
          </div>

          {/* Ambijentalna fotografija brenda (dostavio vlasnik 2026-10-19), ne prikaz
              tačne šifre ili svojstava proizvoda. Original: review-assets/supplied/norbin-2026-10-19. */}
          <figure className={styles.originMedia}>
            <Image
              src="/images/brands/norbin/origin/norbin-paint-hardener-cans-1254x1157.png"
              alt="Limenke Norbin laka i učvršćivača u kutiji"
              fill
              sizes="(min-width: 64rem) 40vw, 100vw"
            />
          </figure>
        </div>
      </div>
    </section>
  );
}

export const norbinFaqData = norbinFaq;
