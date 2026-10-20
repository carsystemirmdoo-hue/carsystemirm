import Image from "next/image";
import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { Footer } from "@/components/layout/Footer";
import { getCarsystemProductBySlug, type CarsystemProduct } from "@/lib/carsystem-data";
import { productCanonicalHref } from "@/lib/product-families";
import {
  sataCleaningSlugs,
  sataCupSlugs,
  sataDocuments,
  sataGunGroups,
  sataMeasurementSlugs,
  sataPreviewMedia,
  sataRmNozzles,
  sataSetupSteps,
  sataTechnologyRows,
  sataWorkshopSlugs,
  type SataPreviewMediaKey,
} from "@/lib/sata-program-preview";
import { SataSprayFan } from "./SataDiagrams";
import styles from "./SataProgramPreview.module.css";

/*
 * SATA — predlog nove brend stranice (2026-10-20). Interna strana pod
 * /interaction-demo (na Vercelu 404, lokalno dostupna, noindex).
 *
 * Raspored: velike fotografije, jasne grupe po poslu, izabrani proizvodi iz
 * našeg kataloga i CTA ka katalogu filtriranom na SATA. Fotografije su
 * kandidati bez potvrđenih prava i prikazuju se samo uz `showMedia`
 * (SATA_PREVIEW_MEDIA=1 lokalno); bez toga strana pokazuje kako izgleda danas,
 * bez SATA fotografija.
 */

const CATALOG = "/katalog?brend=sata";

const navItems = [
  { href: "#pistolji", label: "Pištolji", sectionId: "pistolji" },
  { href: "#tehnologija", label: "RP ili HVLP", sectionId: "tehnologija" },
  { href: "#dizne", label: "Dizne za R-M", sectionId: "dizne" },
  { href: "#merenje", label: "Merenje", sectionId: "merenje" },
  { href: "#case", label: "Čaše", sectionId: "case" },
  { href: "#ciscenje", label: "Čišćenje", sectionId: "ciscenje" },
  { href: "#pribor", label: "Pribor", sectionId: "pribor" },
  { href: "#dokumenti", label: "Dokumenti", sectionId: "dokumenti" },
];

function product(slug: string): CarsystemProduct | null {
  return getCarsystemProductBySlug(slug) ?? null;
}

function shortName(item: CarsystemProduct) {
  // Dugi uvezeni nazivi (npr. sadržaj seta) se skraćuju na prvi deo.
  const [head] = item.name.split(/ containing | sa | za sve /i);
  return head.length > 64 ? `${head.slice(0, 61)}…` : head;
}

function Media({
  mediaKey,
  showMedia,
  sizes,
  className,
  priority,
}: {
  mediaKey: SataPreviewMediaKey;
  showMedia: boolean;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  if (!showMedia) return null;
  const media = sataPreviewMedia[mediaKey];
  return (
    <Image
      alt={media.alt}
      className={className}
      fill
      priority={priority}
      sizes={sizes}
      src={media.src}
      // Lokalni kandidati se ne provlače kroz optimizator slika.
      unoptimized
    />
  );
}

function ProductLinks({ slugs }: { slugs: readonly string[] }) {
  return (
    <ul className={styles.productLinks}>
      {slugs.map((slug) => {
        const item = product(slug);
        if (!item) return null;
        return (
          <li key={slug}>
            <Link href={productCanonicalHref(item)}>
              <span>{shortName(item)}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function SataProgramPreview({ showMedia }: { showMedia: boolean }) {
  return (
    <div className={styles.page} data-brand-page>
      <aside className={styles.previewNotice} aria-label="Status predloga">
        <strong>Predlog za pregled — nije objavljeno.</strong>{" "}
        {showMedia
          ? "Fotografije su sa sata.com i nemaju potvrđeno pravo korišćenja; prikazane su samo lokalno."
          : "Prikaz bez SATA fotografija (stanje dok dozvola ne stigne)."}
      </aside>

      <nav aria-label="Putanja" className={styles.breadcrumb}>
        <Link href="/">Početna</Link>
        <span aria-hidden="true">/</span>
        <Link href="/brendovi">Brendovi</Link>
        <span aria-hidden="true">/</span>
        <strong>SATA</strong>
      </nav>

      {/* ----------------------------------------------------------- uvod */}
      <section className={styles.hero} aria-labelledby="sata-preview-title" data-media={showMedia || undefined}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Oprema za nanošenje · SATA, Nemačka</p>
          <h1 className={styles.heroTitle} id="sata-preview-title">
            SATA
          </h1>
          <p className={styles.heroLead}>
            Pištolj je poslednji korak između mešaone i karoserije. SATA program
            kod nas pokriva taj korak od izbora dizne do čišćenja posle smene.
          </p>
          <div className={styles.actions}>
            <Link className={`${styles.ctaPrimary} cs-cta`} data-cta-on="dark" href={CATALOG}>
              Pogledajte SATA proizvode
              <span aria-hidden="true">→</span>
            </Link>
            <Link className={`${styles.ctaSecondary} cs-cta`} data-cta-on="dark" href="/kontakt?tema=proizvod&brend=sata">
              Pitajte za izbor pištolja
            </Link>
          </div>
        </div>
        <div className={styles.heroMedia}>
          {showMedia ? (
            <>
              <Media className={styles.heroImageDesktop} mediaKey="hero" priority showMedia sizes="(min-width: 64rem) 45vw, 1px" />
              <Media className={styles.heroImageMobile} mediaKey="heroMobile" priority showMedia sizes="(max-width: 63.99rem) 100vw, 1px" />
            </>
          ) : (
            <div className={styles.heroFallback} aria-hidden="true">
              <SataSprayFan shape="I" />
            </div>
          )}
        </div>
      </section>

      <BrandSectionNav ariaLabel="Sekcije SATA predloga" items={navItems} />

      {showMedia ? (
        <div className={styles.band}>
          <Media mediaKey="band" showMedia sizes="100vw" />
        </div>
      ) : null}

      {/* -------------------------------------------------- pištolji po poslu */}
      <section className={styles.section} id="pistolji" aria-labelledby="sata-guns-title">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Pištolji po poslu</p>
          <h2 className={styles.sectionTitle} id="sata-guns-title">
            Pištolj se bira po poslu, ne po imenu.
          </h2>
          <p className={styles.sectionLead}>
            Završni sloj, podloga, sitna popravka ili velika površina — za svaki
            posao u našem katalogu postoji SATA porodica.
          </p>
        </header>

        <div className={styles.gunGroups}>
          {sataGunGroups.map((group, index) => (
            <article
              className={styles.gunGroup}
              data-lead={index === 0 || undefined}
              data-no-media={!(group.lead && showMedia) || undefined}
              key={group.id}
            >
              {group.lead && showMedia ? (
                <div className={styles.gunMedia}>
                  <Media mediaKey={group.lead as SataPreviewMediaKey} showMedia sizes="(min-width: 64rem) 30vw, 90vw" />
                </div>
              ) : null}
              <div className={styles.gunCopy}>
                <p className={styles.kicker}>{group.kicker}</p>
                <h3 className={styles.gunTitle}>{group.title}</h3>
                <p className={styles.gunBody}>{group.body}</p>
                <ProductLinks slugs={group.slugs} />
              </div>
            </article>
          ))}
        </div>
        <p className={styles.sectionFoot}>
          <Link className={`${styles.ctaSecondaryLight} cs-cta`} href={`${CATALOG}&kategorija=oprema`}>
            Svi SATA pištolji i uređaji u katalogu
          </Link>
        </p>
      </section>

      {/* ------------------------------------------------------ RP ili HVLP */}
      <section className={`${styles.section} ${styles.sectionDark}`} id="tehnologija" aria-labelledby="sata-tech-title">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Tehnologija</p>
          <h2 className={styles.sectionTitle} id="sata-tech-title">
            RP ili HVLP: isti pritisak, drugo rastojanje.
          </h2>
          <p className={styles.sectionLead}>
            Primer SATAjet X 5500 sa diznom 1,3 I. Koju tehnologiju i diznu
            izabrati, kaže tehnički list boje.
          </p>
        </header>
        <div className={styles.techGrid}>
          <table className={styles.techTable}>
            <thead>
              <tr>
                <th scope="col">X 5500 · 1,3 I</th>
                <th scope="col">RP</th>
                <th scope="col">HVLP</th>
              </tr>
            </thead>
            <tbody>
              {sataTechnologyRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.rp}</td>
                  <td>{row.hvlp}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className={styles.fans}>
            <figure>
              <SataSprayFan shape="I" />
              <figcaption>
                <strong>I · Control</strong> duži mlaz, ravnomerna raspodela, najveća kontrola
              </figcaption>
            </figure>
            <figure>
              <SataSprayFan shape="O" />
              <figcaption>
                <strong>O · Speed</strong> ovalan mlaz, vlažnije jezgro, brže nanošenje
              </figcaption>
            </figure>
          </div>
          <ol className={styles.steps}>
            {sataSetupSteps.map((step, index) => (
              <li key={step.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step.title}</strong>
                <small>{step.body}</small>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------- dizne za R-M */}
      <section className={styles.section} id="dizne" aria-labelledby="sata-rm-title">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>SATA i R-M</p>
          <h2 className={styles.sectionTitle} id="sata-rm-title">
            Dizna za R-M materijale iz naše ponude.
          </h2>
          <p className={styles.sectionLead}>
            SATA objavljuje tablice primene po proizvođaču boje. Ovo je izvod za
            R-M materijale koje nudimo.
          </p>
        </header>
        <div className={styles.tableWrap} role="region" aria-label="Dizne za R-M materijale" tabIndex={0}>
          <table className={styles.nozzleTable}>
            <thead>
              <tr>
                <th scope="col">R-M materijal</th>
                <th scope="col">SATAjet X 5500 RP</th>
                <th scope="col">SATAjet X 5500 HVLP</th>
                <th scope="col">SATAminijet 4400 B (spot)</th>
              </tr>
            </thead>
            <tbody>
              {sataRmNozzles.map((row) => {
                const item = product(row.slug);
                return (
                  <tr key={row.slug}>
                    <th scope="row">
                      {item ? <Link href={productCanonicalHref(item)}>{row.name}</Link> : row.name}
                    </th>
                    <td>{row.rp}</td>
                    <td>{row.hvlp}</td>
                    <td>{row.spot}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>
          Izvor: <a href={sataDocuments[0].href} rel="noopener noreferrer" target="_blank">SATA tablica primene za R-M ↗</a>.
          Tablica važi za navedene modele; za jet X SATA ne objavljuje R-M tablicu.
          Važeći podatak je uvek tehnički list R-M materijala.
        </p>
      </section>

      {/* --------------------------------------------------------- merenje */}
      <section className={`${styles.section} ${styles.sectionSplit}`} id="merenje" aria-labelledby="sata-measure-title">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Digitalno merenje</p>
          <h2 className={styles.sectionTitle} id="sata-measure-title">
            Pritisak na pištolju je podatak, ne procena.
          </h2>
          <p className={styles.sectionLead}>
            adam X pro na samom pištolju prikazuje stvarni i zadati pritisak i
            upozorava kad podešavanje odstupi. QMR reguliše protok materijala.
          </p>
        </header>
        <ProductLinks slugs={sataMeasurementSlugs} />
      </section>

      {/* ----------------------------------------------------------- čaše */}
      <section className={`${styles.section} ${styles.photoSection}`} id="case" aria-labelledby="sata-cups-title">
        <div className={styles.photoPair} data-media={showMedia || undefined}>
          <figure>
            <Media mediaKey="sata-rps-the-original" showMedia={showMedia} sizes="(min-width: 64rem) 30vw, 50vw" />
            <figcaption>RPS</figcaption>
          </figure>
          <figure>
            <Media mediaKey="sata-lcs-the-liner" showMedia={showMedia} sizes="(min-width: 64rem) 30vw, 50vw" />
            <figcaption>LCS</figcaption>
          </figure>
        </div>
        <div className={styles.photoCopy}>
          <p className={styles.eyebrow}>Čaše i RPS</p>
          <h2 className={styles.sectionTitle} id="sata-cups-title">
            Jedna čaša za mešanje, nanošenje i čuvanje.
          </h2>
          <p className={styles.sectionLead}>
            U RPS čaši se boja meša, nanosi, dopunjava i čuva — bez pretakanja. Na
            SATA pištolje ide bez adaptera; za stariji pištolj bez QCC priključka
            postoji adapter.
          </p>
          <ul className={styles.facts}>
            <li>0,3 · 0,6 · 0,9 l</li>
            <li>sito 125 ili 200 µm, prema preporuci proizvođača boje</li>
            <li>nagib do 45° napred i u stranu</li>
          </ul>
          <ProductLinks slugs={sataCupSlugs} />
        </div>
      </section>

      {/* -------------------------------------------------------- čišćenje */}
      <section className={`${styles.section} ${styles.photoSection} ${styles.sectionReverse}`} id="ciscenje" aria-labelledby="sata-clean-title">
        <div className={styles.photoPair} data-media={showMedia || undefined}>
          <figure>
            <Media mediaKey="sata-clean-rcs" showMedia={showMedia} sizes="(min-width: 64rem) 30vw, 50vw" />
            <figcaption>clean RCS</figcaption>
          </figure>
          <figure>
            <Media mediaKey="sata-multi-clean-2" showMedia={showMedia} sizes="(min-width: 64rem) 30vw, 50vw" />
            <figcaption>multi clean 2</figcaption>
          </figure>
        </div>
        <div className={styles.photoCopy}>
          <p className={styles.eyebrow}>Čišćenje i nega</p>
          <h2 className={styles.sectionTitle} id="sata-clean-title">
            Čist pištolj je deo podešavanja.
          </h2>
          <p className={styles.sectionLead}>
            clean RCS u kabini opere kanal boje i vazdušnu kapu za oko pola
            minuta, bez skidanja pištolja sa creva. multi clean 2 na kraju dana
            radi temeljno pranje u zatvorenom sistemu.
          </p>
          <ul className={styles.facts}>
            <li>pištolj se ne potapa u razređivač</li>
            <li>vodeno sredstvo za čišćenje pH 6–8</li>
            <li>posle pranja pištolj se suši duvanjem</li>
          </ul>
          <ProductLinks slugs={sataCleaningSlugs} />
        </div>
      </section>

      {/* ---------------------------------------------------------- pribor */}
      <section className={styles.section} id="pribor" aria-labelledby="sata-workshop-title">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Pribor i odeća</p>
          <h2 className={styles.sectionTitle} id="sata-workshop-title">
            Sve što stoji oko pištolja.
          </h2>
          <p className={styles.sectionLead}>
            Držači, creva i spojke, sušenje vodenih boja, dnevno svetlo za
            proveru tona i radna odeća. Vazdušno crevo treba da bude antistatičko
            i menja se najmanje jednom godišnje.
          </p>
        </header>
        <div className={styles.workshopGrid}>
          <ProductLinks slugs={sataWorkshopSlugs} />
        </div>
        <p className={styles.sectionFoot}>
          <Link className={`${styles.ctaSecondaryLight} cs-cta`} href={`${CATALOG}&kategorija=pribor`}>
            SATA pribor u katalogu
          </Link>
          <Link className={`${styles.ctaSecondaryLight} cs-cta`} href={`${CATALOG}&kategorija=radionica`}>
            SATA oprema za radionicu
          </Link>
        </p>
      </section>

      {/* -------------------------------------------------------- dokumenti */}
      <section className={styles.section} id="dokumenti" aria-labelledby="sata-docs-title">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Dokumenti</p>
          <h2 className={styles.sectionTitle} id="sata-docs-title">
            Tehnička dokumentacija je na SATA sajtu.
          </h2>
          <p className={styles.sectionLead}>
            Uputstva i izjave o usaglašenosti za svaki pištolj nalaze se i na
            stranici proizvoda u katalogu.
          </p>
        </header>
        <ul className={styles.docList}>
          {sataDocuments.map((doc) => (
            <li key={doc.href}>
              <a href={doc.href} rel="noopener noreferrer" target="_blank">
                <strong>{doc.title}</strong>
                <span>{doc.note}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* ------------------------------------------------------ završni CTA */}
      <section className={`${styles.section} ${styles.final}`} aria-labelledby="sata-final-title">
        <h2 className={styles.sectionTitle} id="sata-final-title">
          Ceo SATA asortiman koji nudimo je u katalogu.
        </h2>
        <p className={styles.sectionLead}>Konfiguraciju i dostupnost potvrđujemo na upit.</p>
        <div className={styles.actions}>
          <Link className={`${styles.ctaPrimary} cs-cta`} data-cta-on="dark" href={CATALOG}>
            Pogledajte sve SATA proizvode
            <span aria-hidden="true">→</span>
          </Link>
          <Link className={`${styles.ctaSecondary} cs-cta`} data-cta-on="dark" href="/prodavnice">
            Pronađite najbližu prodavnicu
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
