import Image from "next/image";
import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { Footer } from "@/components/layout/Footer";
import type { CarsystemProduct } from "@/lib/carsystem-data";
import { NorbinGreyShade } from "./NorbinGreyShade";
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

        <div className={styles.heroGrid}>
          <div>
            <div className={styles.heroIdentity}>
              <Image src="/brands/norbin.svg" alt="Norbin" width={120} height={40} priority />
              <div>
                <strong>NORBIN</strong>
                <span>Surventis refinish porodica</span>
              </div>
            </div>

            <p className={styles.heroKicker}>Pomoćni program za lakirnicu</p>
            <h1 className={styles.heroTitle} id="norbin-hero-title">
              Kratak program koji radi u odnosima.
            </h1>
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
              <div>
                <strong>0</strong>
                <span>bez sistema boje</span>
              </div>
            </div>

            <div className={styles.heroActions}>
              <Link className={styles.buttonPrimary} href="/prodavnice">
                Pronađite najbližu prodavnicu
              </Link>
              <Link className={styles.buttonSecondary} href="/katalog?brend=norbin">
                Pogledajte Norbin proizvode
              </Link>
              <Link className={styles.buttonText} href="/kontakt?tema=proizvod&brend=norbin">
                Pošaljite upit →
              </Link>
            </div>
          </div>

          <div className={styles.heroCrossing}>
            <span className={`${styles.heroRibbon} ${styles.heroRibbonBlue}`} aria-hidden="true" />
            <span className={`${styles.heroRibbon} ${styles.heroRibbonGold}`} aria-hidden="true" />
            <div className={styles.heroPhotoWedge}>
              <div className={styles.heroPhotoWedgeEmpty} role="img" aria-label="Fotografija radionice još nije dostupna">
                Fotografija u pripremi
              </div>
            </div>
          </div>
        </div>
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
          Pet odnosa mešanja pokrivaju ceo Norbin program — baza i
          učvršđivač uvek idu u tačno propisanoj razmeri, prema tehničkom
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
          Puni EMEA program ima 13 proizvoda. U našoj ponudi je danas
          potvrđen N15-020, u dva pakovanja — dostupnost ostalih artikala
          potvrđujemo kroz upit.
        </p>

        <div className={styles.programLayout}>
          <div className={styles.stockedGrid}>
            {products.map((product) => (
              <Link
                className={styles.stockedCard}
                href={productCanonicalHref(product)}
                key={product.slug}
              >
                <div className={styles.stockedMedia}>
                  {product.productImage &&
                  !product.productImage.src.includes("placeholder-product") ? (
                    <Image
                      src={product.productImage.src}
                      alt={product.productImage.alt}
                      fill
                      sizes="(min-width: 64rem) 18vw, 42vw"
                    />
                  ) : (
                    <div
                      className={styles.stockedNoImage}
                      role="img"
                      aria-label={`Fotografija za ${product.name} još nije dostupna`}
                    >
                      <span className={styles.stockedNoImageMark}>NORBIN</span>
                    </div>
                  )}
                </div>
                <div className={styles.stockedCopy}>
                  <strong>{product.sku}</strong>
                  <small>{product.packages?.[0]?.label ?? product.name}</small>
                </div>
              </Link>
            ))}
          </div>

          <div className={styles.systemPanel}>
            <p>
              Pun EMEA program ima 13 proizvoda u pet familija odnosa
              mešanja. Dostupnost artikala van trenutne ponude potvrđuje se
              kroz upit — ne prikazujemo ih kao proizvode sa strane sajta.
            </p>
            <p>
              <Link className={styles.buttonText} href="/kontakt?tema=proizvod&brend=norbin">
                Pošaljite upit za drugi Norbin artikal →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TechnicalSection() {
  const withTds = norbinRatios.map((row) => row.base);

  return (
    <section
      id="tehnicki-podaci"
      className={`${styles.section} ${styles.anchor}`}
      aria-labelledby="norbin-tech-title"
    >
      <div className={styles.container}>
        <p className={styles.sectionKicker}>Tehnički podaci</p>
        <h2 className={styles.sectionTitle} id="norbin-tech-title">
          Vrednosti onako kako su odštampane.
        </h2>

        <div className={styles.techLayout}>
          {withTds.map((code) => (
            <details className={styles.techItem} key={code}>
              <summary>{code}</summary>
              <dl className={styles.techTable}>
                <div>
                  <dt>Šifra</dt>
                  <dd>{code}</dd>
                </div>
                <div>
                  <dt>Odnos mešanja</dt>
                  <dd>
                    {norbinRatios.find((row) => row.base === code)?.ratio}
                  </dd>
                </div>
              </dl>
            </details>
          ))}
          <p className={styles.techNoData}>
            Za ostale proizvode u programu proizvođač ne objavljuje poseban
            tehnički list — podaci se nalaze u listu proizvoda sa kojim se
            mešaju (pogledajte odeljak Odnos, iznad).
          </p>
        </div>
      </div>
    </section>
  );
}

function DocumentationSection() {
  const groups = norbinRatios.map((row) => row.base);

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

        <div className={styles.docGroups}>
          {groups.map((code) => (
            <div className={styles.docGroup} key={code}>
              <h3>{code}</h3>
              <ul>
                <li>
                  <a href="https://www.norbin-paint.com/" target="_blank" rel="noreferrer">
                    Tehnički list ↗
                  </a>
                </li>
                <li>
                  <a href="https://www.norbin-paint.com/" target="_blank" rel="noreferrer">
                    Bezbednosni list ↗
                  </a>
                </li>
              </ul>
            </div>
          ))}
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
              <Link className={styles.buttonPrimary} href="/prodavnice">
                Pronađite najbližu prodavnicu
              </Link>
              <Link className={styles.buttonText} href="/kontakt?tema=proizvod&brend=norbin">
                Pošaljite upit →
              </Link>
            </div>
          </div>

          <div className={styles.originMedia}>
            <div className={styles.originMediaEmpty}>Fotografija u pripremi</div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const norbinFaqData = norbinFaq;
