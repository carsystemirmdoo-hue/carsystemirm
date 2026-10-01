import Link from "next/link";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { Footer } from "@/components/layout/Footer";
import {
  type CarsystemBrand,
  type CarsystemProduct,
  programGroups,
  refinishPhases,
} from "@/lib/carsystem-data";
import {
  SATA_OFFICIAL,
  sataArguments,
  sataChain,
  sataFamilyGroups,
  sataHeroReadouts,
  sataNozzleLetters,
  sataSections,
  sataSelectorRows,
  sataServices,
  sataTechColumns,
} from "@/lib/sata-brand-data";
import {
  SataFilterStack,
  SataPressureTrace,
  SataSprayFan,
} from "./SataDiagrams";
import styles from "./SataBrandPage.module.css";

type Props = {
  brand: CarsystemBrand;
  products: CarsystemProduct[];
};

const navItems = sataSections.map((section) => ({
  href: `#${section.id}`,
  label: section.label,
  sectionId: section.id,
}));

/**
 * Namenska SATA brend stranica.
 *
 * Server komponenta. Jedini klijentski deo je zajednički `BrandSectionNav`,
 * koji je već deljena infrastruktura projekta — nema novih scroll listenera,
 * nema per-sekciju JS-a, nijedan sadržaj ne zavisi od hovera.
 *
 * Sadržajna pravila su u `lib/sata-brand-data.ts`. Najvažnije: SATA je oprema,
 * ne premaz; globalni program nije naša ponuda; `jet X` je aktuelna referenca,
 * a `SATAjet X 5500` i dalje aktuelna, ali starija premium porodica.
 */
export function SataBrandPage({ brand, products }: Props) {
  const programBySlug = new Map(programGroups.map((program) => [program.slug, program]));
  const phaseBySlug = new Map(refinishPhases.map((phase) => [phase.slug, phase]));

  return (
    <main className={styles.page} data-brand-page="sata">
      <nav aria-label="Putanja" className={styles.breadcrumb}>
        <ol>
          <li>
            <Link href="/">Početna</Link>
          </li>
          <li aria-hidden="true" className={styles.breadcrumbSeparator}>
            /
          </li>
          <li>
            <Link href="/brendovi">Brendovi</Link>
          </li>
          <li aria-hidden="true" className={styles.breadcrumbSeparator}>
            /
          </li>
          <li aria-current="page">SATA</li>
        </ol>
      </nav>

      {/* ------------------------------------------------------------ 01 HERO */}
      <section aria-labelledby="sata-hero-title" className={styles.hero}>
        <div className={styles.heroGrid}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Oprema za nanošenje · proizvođač iz Nemačke</p>
            <h1 className={styles.heroTitle} id="sata-hero-title">
              SATA
            </h1>
            <p className={styles.heroLead}>
              SATA ne pravi boje. SATA pravi opremu kojom se boja nanosi — pištolje,
              cup sisteme, pripremu komprimovanog vazduha i merenje pritiska. Sve
              što stoji između miksera i lima.
            </p>
            <p className={styles.heroBody}>
              Ono što ceo program drži na okupu je ponovljivost: podešavanje koje
              ste danas našli treba da bude vrednost koju sutra ponovite, a ne
              osećaj koji tražite iznova.
            </p>

            <div className={styles.heroActions}>
              <Link className={styles.ctaPrimary} href="#program">
                Pogledajte program
                <span aria-hidden="true">→</span>
              </Link>
              <Link className={styles.ctaSecondary} href={brand.routes.contact}>
                Pošaljite upit za izbor opreme
              </Link>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <dl className={styles.readouts}>
              {sataHeroReadouts.map((readout) => (
                <div className={styles.readout} key={readout.label}>
                  <dt className={styles.readoutLabel}>{readout.label}</dt>
                  <dd className={styles.readoutValue}>{readout.value}</dd>
                  <dd className={styles.readoutScope}>{readout.scope}</dd>
                </div>
              ))}
            </dl>
            <SataPressureTrace />
            <p className={styles.readoutFoot}>
              Vrednosti se odnose na navedene konfiguracije, ne na program u celini.
            </p>
          </div>
        </div>
      </section>

      <BrandSectionNav ariaLabel="Sekcije SATA stranice" items={navItems} />

      {/* -------------------------------------------------------- 02 ZAŠTO */}
      <section aria-labelledby="sata-zasto-title" className={styles.section} id="zasto">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Zašto SATA</p>
          <h2 className={styles.sectionTitle} id="sata-zasto-title">
            Četiri stvari koje imaju broj iza sebe
          </h2>
          <p className={styles.sectionLead}>
            Sve navedeno je podatak sa zvanične SATA dokumentacije, uz naznaku na
            koju konfiguraciju se odnosi.
          </p>
        </header>

        <ol className={styles.argumentList}>
          {sataArguments.map((argument) => (
            <li className={styles.argument} key={argument.id}>
              <p className={styles.argumentIndex} aria-hidden="true">
                {argument.index}
              </p>
              <h3 className={styles.argumentTitle}>{argument.title}</h3>
              <p className={styles.argumentBody}>{argument.body}</p>
              <p className={styles.argumentEvidence}>{argument.evidence}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------- 03 SISTEM */}
      <section aria-labelledby="sata-sistem-title" className={styles.systemSection} id="sistem">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Radni sistem</p>
          <h2 className={styles.sectionTitle} id="sata-sistem-title">
            Šest koraka od kompresora do gotovog sloja
          </h2>
          <p className={styles.sectionLead}>
            Svaki korak ima potvrđenu SATA kategoriju iza sebe. Ako jedan korak
            nije pod kontrolom, ni podešavanje pištolja se neće ponoviti.
          </p>
        </header>

        <ol className={styles.chain}>
          {sataChain.map((stage) => (
            <li className={styles.chainStage} key={stage.id}>
              <p className={styles.chainStep} aria-hidden="true">
                {stage.step}
              </p>
              <h3 className={styles.chainTitle}>{stage.title}</h3>
              <p className={styles.chainBody}>{stage.body}</p>
              <ul className={styles.chainParts} aria-label={`Porodice: ${stage.title}`}>
                {stage.parts.map((part) => (
                  <li key={part}>{part}</li>
                ))}
              </ul>
              {stage.id === "vazduh" ? (
                <div className={styles.chainDiagram}>
                  <SataFilterStack />
                  <p className={styles.chainDiagramNote}>
                    Trostepena izvedba: separator ulja i vode, fini filter,
                    aktivni ugalj. Vrednosti prema SATA filter 584.
                  </p>
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------- 04 PROGRAM */}
      <section aria-labelledby="sata-program-title" className={styles.section} id="program">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Program proizvođača</p>
          <h2 className={styles.sectionTitle} id="sata-program-title">
            Porodice SATA programa
          </h2>
          <p className={styles.sectionLead}>
            Pregled aktuelnog programa SATA GmbH &amp; Co. KG, grupisan po poslu koji
            pokriva.
          </p>
        </header>

        <p className={styles.scopeNotice} role="note">
          <strong>Ovo je program proizvođača, ne naš lager.</strong> Prisustvo
          proizvoda u našem online katalogu nije potvrda prodaje ni zaliha. Za
          dostupnost, konfiguraciju i rok isporuke kontaktirajte Carsystem i R-M
          — cene, zalihe i rokovi ovde nisu navedeni.
        </p>

        <div className={styles.familyGrid}>
          {sataFamilyGroups.map((group) => (
            <article className={styles.familyGroup} key={group.id}>
              <h3 className={styles.familyGroupTitle}>{group.title}</h3>
              <p className={styles.familyGroupBody}>{group.body}</p>
              <ul className={styles.familyList}>
                {group.families.map((family) => (
                  <li className={styles.familyItem} key={family.name}>
                    <p className={styles.familyName}>
                      {family.name}
                      {family.highlight ? (
                        <span className={styles.familyTag}>Aktuelna referenca</span>
                      ) : null}
                    </p>
                    <p className={styles.familyRole}>{family.role}</p>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------- 05 TEHNOLOGIJA */}
      <section
        aria-labelledby="sata-tehnologija-title"
        className={styles.techSection}
        id="tehnologija"
      >
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Istaknuta tehnologija</p>
          <h2 className={styles.sectionTitle} id="sata-tehnologija-title">
            jet X je nova referenca. X 5500 nije ukinut.
          </h2>
          <p className={styles.sectionLead}>
            Dve premium porodice postoje paralelno u zvaničnom katalogu. Razlika
            nije u tome koja je &bdquo;bolja&ldquo;, nego u tome šta se meri i kako se mlaz
            oblikuje.
          </p>
        </header>

        <div className={styles.techGrid}>
          {sataTechColumns.map((column) => (
            <article
              className={styles.techColumn}
              data-lead={column.id === "jet-x" || undefined}
              key={column.id}
            >
              <p className={styles.techStanding}>{column.standing}</p>
              <h3 className={styles.techName}>{column.name}</h3>
              <p className={styles.techLead}>{column.lead}</p>

              <ul className={styles.techFeatures}>
                {column.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <dl className={styles.techSpecs}>
                {column.specs.map((spec) => (
                  <div className={styles.techSpecRow} key={spec.label}>
                    <dt>{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>
              <p className={styles.techScope}>{column.specScope}</p>
            </article>
          ))}
        </div>

        <div className={styles.nozzleBlock}>
          <h3 className={styles.nozzleTitle}>Mlaz I ili mlaz O</h3>
          <p className={styles.nozzleLead}>
            Obe porodice nude isti izbor, pod različitim oznakama — kod{" "}
            <span className={styles.mono}>jet X</span> to su{" "}
            <span className={styles.mono}>I (Control)</span> i{" "}
            <span className={styles.mono}>O (Speed)</span>. To je odluka koju
            lakirer stvarno donosi.
          </p>
          <div className={styles.nozzleGrid}>
            {sataNozzleLetters.map((nozzle) => (
              <div className={styles.nozzle} key={nozzle.letter}>
                <SataSprayFan shape={nozzle.letter === "I" ? "I" : "O"} />
                <div>
                  <p className={styles.nozzleLetter}>
                    <span aria-hidden="true">{nozzle.letter}</span>
                    <span className={styles.nozzleName}>{nozzle.name}</span>
                  </p>
                  <p className={styles.nozzleBody}>{nozzle.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- 06 IZBOR */}
      <section aria-labelledby="sata-izbor-title" className={styles.section} id="izbor">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Izbor rešenja</p>
          <h2 className={styles.sectionTitle} id="sata-izbor-title">
            Krenite od posla, ne od modela
          </h2>
          <p className={styles.sectionLead}>
            Oblast programa se bira prema materijalu i površini. Tačna
            konfiguracija se potvrđuje kroz upit.
          </p>
        </header>

        <ul className={styles.selectorList}>
          {sataSelectorRows.map((row) => (
            <li className={styles.selectorRow} key={row.id}>
              <p className={styles.selectorTask}>{row.task}</p>
              <dl className={styles.selectorMeta}>
                <div>
                  <dt>Oblast</dt>
                  <dd>{row.area}</dd>
                </div>
                <div>
                  <dt>Porodice</dt>
                  <dd className={styles.mono}>{row.families.join(" · ")}</dd>
                </div>
                <div>
                  <dt>Šta se bira</dt>
                  <dd>{row.decision}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      {/* -------------------------------------------------------- 07 SERVIS */}
      <section aria-labelledby="sata-servis-title" className={styles.section} id="servis">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>Servis i podrška</p>
          <h2 className={styles.sectionTitle} id="sata-servis-title">
            Delovi, garancija i izbor konfiguracije
          </h2>
          <p className={styles.sectionLead}>
            Prve dve stavke vodi SATA i otvaraju se na zvaničnom sajtu
            proizvođača. Treću radimo mi.
          </p>
        </header>

        <div className={styles.serviceGrid}>
          {sataServices.map((service) => (
            <article className={styles.serviceCard} key={service.id}>
              <h3 className={styles.serviceTitle}>{service.title}</h3>
              <p className={styles.serviceBody}>{service.body}</p>
              {service.href ? (
                <a
                  className={styles.serviceLink}
                  href={service.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  {service.linkLabel}
                  <span className={styles.srOnly}> (otvara sata.com u novoj kartici)</span>
                  <span aria-hidden="true"> ↗</span>
                </a>
              ) : (
                <Link className={styles.serviceLink} href={brand.routes.contact}>
                  Pošaljite upit
                  <span aria-hidden="true"> →</span>
                </Link>
              )}
            </article>
          ))}
        </div>

        <p className={styles.serviceNote} role="note">
          Nemamo objavljene SATA tehničke listove ni uputstva. Zvanična
          dokumentacija po artiklu nalazi se na{" "}
          <a href={SATA_OFFICIAL.site} rel="noreferrer" target="_blank">
            sata.com
            <span className={styles.srOnly}> (otvara se u novoj kartici)</span>
          </a>
          .
        </p>
      </section>

      {/* -------------------------------------------------------- 08 KOD NAS */}
      <section aria-labelledby="sata-kod-nas-title" className={styles.localSection} id="kod-nas">
        <header className={styles.sectionHead}>
          <p className={styles.eyebrow}>SATA u našem online katalogu</p>
          <h2 className={styles.sectionTitle} id="sata-kod-nas-title">
            Šta je evidentirano u katalogu
          </h2>
        </header>

        {/*
          Kataloški unos nije dokaz prodaje. Ova rečenica je jedina tvrdnja koju
          smemo da iznesemo o našoj ulozi dok komercijalni status nije potvrđen
          (vidi docs/SATA_RESEARCH.md §5), pa stoji odmah ispod naslova.
        */}
        {products.length > 0 ? (
          <p className={styles.localLead}>
            Trenutno evidentirano u našem online katalogu:{" "}
            {products.length === 1 ? "1 proizvod" : `${products.length} proizvoda`}. Za
            dostupnost, konfiguraciju i rok isporuke kontaktirajte Carsystem i R-M.
          </p>
        ) : null}

        {products.length > 0 ? (
          <div className={styles.localBody}>
            <div className={styles.localGrid}>
              {products.map((product) => {
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

            <aside className={styles.localAside}>
              <p className={styles.localCount}>
                <span className={styles.localCountValue}>{products.length}</span>
                <span>
                  {products.length === 1
                    ? "proizvod evidentiran"
                    : "proizvoda evidentirano"}{" "}
                  u online katalogu
                </span>
              </p>
              <h3 className={styles.localAsideTitle}>Zašto je lista kratka</h3>
              <p className={styles.localAsideBody}>
                U katalog ulazi samo ono za šta imamo proverene tehničke podatke.
                Evidencija u katalogu nije izjava o prodaji, zalihama ni ceni —
                ceo program iznad je ponuda proizvođača SATA.
              </p>
              <p className={styles.localAsideBody}>
                Nemamo objavljene SATA fotografije proizvoda ni tehničku
                dokumentaciju, pa kartica prikazuje stanje „vizuel u pripremi“
                umesto slike koja nije naša.
              </p>
            </aside>
          </div>
        ) : (
          <p className={styles.localLead}>
            Trenutno evidentirano u našem online katalogu: nijedan SATA proizvod.
            Za dostupnost, konfiguraciju i rok isporuke kontaktirajte Carsystem i
            R-M.
          </p>
        )}

        <div className={styles.localCta}>
          <div>
            <h3 className={styles.localCtaTitle}>Proverite dostupnost</h3>
            <p className={styles.localCtaBody}>
              Napišite koji materijal radite i kakav vazduh imate u radionici, pa
              predlažemo oblast programa i konfiguraciju. Bez obaveze i bez
              javnih cena.
            </p>
          </div>
          <div className={styles.localCtaActions}>
            <Link className={styles.ctaPrimary} href={brand.routes.contact}>
              Pošaljite upit
              <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.ctaSecondary} href="/prodavnice">
              Pronađite najbližu prodavnicu
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
