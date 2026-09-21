import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import {
  carfitAbrasiveStory,
  carfitCategories,
  carfitDocumentation,
  carfitFamilies,
  carfitFinalCta,
  carfitFinishStory,
  carfitHero,
  carfitMaskingStory,
  carfitNav,
  carfitStory,
  carfitTasks,
  carfitWorkbenchZones,
  getCarfitCategoryById,
  getCarfitProducts,
  resolveCarfitProducts,
} from "@/lib/carfit-brand-data";
import {
  getProductPublicStatus,
  programGroups,
  refinishPhases,
  type CarsystemBrand,
  type CarsystemProduct,
} from "@/lib/carsystem-data";
import { CarfitHeroMarkers } from "./CarfitHeroMarkers";
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { CarfitMedia } from "./CarfitMedia";
import { CarfitProductShowcase } from "./CarfitProductShowcase";
import { CarfitReveal } from "./CarfitReveal";
import { CarfitTaskSelector } from "./CarfitTaskSelector";
import type { CarfitProductView, CarfitTaskView } from "./carfit-view";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { getFeaturedDocuments } from "@/lib/documents";
import styles from "./CarfitBrandPage.module.css";

/** Stabilna referenca — `BrandSectionNav` je drži u zavisnostima efekta. */
const carfitSectionNavItems = carfitNav.map((item) => ({
  href: `#${item.id}`,
  label: item.label,
  sectionId: item.id,
}));

const carfitFeaturedDocuments = getFeaturedDocuments("carfit");

const programNameBySlug = new Map(programGroups.map((program) => [program.slug, program.shortName]));
const phaseNameBySlug = new Map(refinishPhases.map((phase) => [phase.slug, phase.name]));

/**
 * Generički placeholder iz centralnog kataloga se na ovoj stranici ne prikazuje —
 * umesto njega ide tehnički modul iz workshop mreže, koji je deo dizajna.
 */
const GENERIC_PLACEHOLDER_IMAGE = "/images/products/placeholder-product.svg";

function realImage(product: CarsystemProduct) {
  const candidates = [product.productImage, ...product.galleryImages];
  return candidates.find((asset) => asset && asset.src !== GENERIC_PLACEHOLDER_IMAGE) ?? null;
}

function toProductView(product: CarsystemProduct): CarfitProductView {
  const image = realImage(product);

  return {
    slug: product.slug,
    name: product.name,
    purpose: product.purpose,
    shortDescription: product.shortDescription,
    phaseSlug: product.phaseSlug,
    phaseName: phaseNameBySlug.get(product.phaseSlug) ?? "",
    programName: programNameBySlug.get(product.programSlug) ?? "",
    status: getProductPublicStatus(product),
    sku: product.sku,
    packageLabel: product.packages.map((item) => item.label).join(" / "),
    image: image ? { src: image.src, alt: image.alt } : null,
    href: `/proizvodi/${product.slug}`,
  };
}

function buildTaskViews(): CarfitTaskView[] {
  return carfitTasks.map((task) => {
    const products = resolveCarfitProducts(task).map(toProductView);
    const categories = task.categoryIds
      .map((id) => getCarfitCategoryById(id))
      .filter((category): category is NonNullable<typeof category> => Boolean(category))
      .map((category) => ({
        id: category.id,
        name: category.name,
        href: category.catalogTarget?.href ?? null,
      }));

    return {
      id: task.id,
      code: task.code,
      label: task.label,
      marker: task.marker,
      lead: task.lead,
      body: task.body,
      workflow: task.workflow,
      categories,
      products,
      // Bez lokalnih artikala korak i dalje dobija pun sadržaj: šta pokriva i
      // kome se obratiti. Nikakva tvrdnja o dostupnosti se ne izriče.
      scopeNote:
        products.length > 0
          ? null
          : {
              title: "Materijal za ovaj zahvat",
              body: `Korak pokriva ${categories
                .map((category) => category.name.toLowerCase())
                .join(", ")}. Za izbor prema konkretnom vozilu i vrsti oštećenja, tim Carsystem i R-M daje tehničku preporuku.`,
            },
      catalogTarget: task.catalogTarget,
      media: task.media,
    };
  });
}

export function CarfitBrandPage({ brand }: { brand: CarsystemBrand }) {
  const wordmark = brand.wordmark ?? brand.name;
  const products = getCarfitProducts();
  const productViews = products.map(toProductView);
  const taskViews = buildTaskViews();
  const heroProduct = productViews.find((product) => product.image) ?? null;

  const categoryViews = carfitCategories.map((category) => ({
    ...category,
    count: resolveCarfitProducts(category, 99).length,
  }));

  const familyViews = carfitFamilies.map((family) => {
    const count = family.categoryIds.reduce((total, id) => {
      const category = getCarfitCategoryById(id);
      return total + (category ? resolveCarfitProducts(category, 99).length : 0);
    }, 0);
    const target = getCarfitCategoryById(family.categoryIds[0])?.catalogTarget ?? null;
    return { ...family, count, target };
  });

  return (
    // `data-brand-page` uključuje stranicu u zajednički sistem sticky offseta
    // (`BrandSectionNav` na njega upisuje stvarnu visinu globalnog headera).
    <div className={styles.pageShell} data-brand-page>
      <noscript>
        {/* Bez JavaScripta reveal stanje se ne primenjuje — sadržaj je odmah vidljiv. */}
        <style>{`[data-cf-reveal]{opacity:1 !important;transform:none !important}`}</style>
      </noscript>

      <main className={styles.main}>
        {/* ---------------------------------------------------------- hero */}
        <section
          className={`${styles.hero} ${styles.gridSkin} ${styles.gridSkinInvert} ${styles.anchor}`}
          id="pregled"
          aria-labelledby="carfit-title"
        >
          {/* Breadcrumb živi unutar hero površine — poseban tamni bar odmah ispod
              globalnog headera čitao se kao drugi header. */}
          <nav className={styles.breadcrumb} aria-label="Putanja">
            <div className={styles.container}>
              <ol>
                <li>
                  <Link href="/">Početna</Link>
                  <span className={styles.breadcrumbSeparator} aria-hidden="true">
                    /
                  </span>
                </li>
                <li>
                  <Link href="/brendovi">Brendovi</Link>
                  <span className={styles.breadcrumbSeparator} aria-hidden="true">
                    /
                  </span>
                </li>
                <li className={styles.breadcrumbCurrent} aria-current="page">
                  {brand.name}
                </li>
              </ol>
            </div>
          </nav>

          <div className={`${styles.container} ${styles.heroInner}`}>
            <div className={styles.heroCopy}>
              <p className={styles.heroBrandMark}>
                <Image
                  alt={`${wordmark} logo`}
                  className={styles.heroLogo}
                  height={329}
                  priority
                  // `logo` je opciono na tipu brenda; Car Fit ga uvek ima.
                  src={brand.logo ?? "/brands/carfit.svg"}
                  width={1989}
                />
              </p>
              <p className={styles.heroEyebrow}>{carfitHero.eyebrow}</p>
              <h1 className={styles.heroTitle} id="carfit-title">
                {carfitHero.title}
              </h1>
              <p className={styles.heroLead}>{carfitHero.lead}</p>
              <p className={styles.heroSecondary}>{carfitHero.secondary}</p>

              <div className={styles.heroActions}>
                <a
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  href={carfitHero.primaryCta.href}
                >
                  {carfitHero.primaryCta.label}
                </a>
                <a
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  href={carfitHero.secondaryCta.href}
                >
                  {carfitHero.secondaryCta.label}
                </a>
              </div>
            </div>

            <div className={styles.heroStage}>
              <div className={styles.stage}>
                <div className={`${styles.stageCell} ${styles.stageCellWide}`}>
                  <p className={styles.stageCode}>
                    {heroProduct ? heroProduct.programName : carfitHero.media.id}
                  </p>
                  <div className={styles.stageMedia}>
                    {heroProduct?.image ? (
                      <Image
                        alt={heroProduct.image.alt}
                        className={styles.stageImage}
                        height={900}
                        priority
                        sizes="(min-width: 64rem) 36vw, 88vw"
                        src={heroProduct.image.src}
                        width={900}
                      />
                    ) : (
                      <CarfitMedia
                        mark={wordmark}
                        priority
                        sizes="(min-width: 64rem) 36vw, 88vw"
                        slot={carfitHero.media}
                      />
                    )}
                  </div>
                  {/*
                    Namerno bez naziva/varijante artikla: hero koristi fotografiju
                    kao brend materijal, a konkretna varijanta se tvrdi tek na
                    stranici proizvoda gde je podatak proveren.
                  */}
                  <div>
                    <p className={styles.stageLabel}>Maskiranje</p>
                    <p className={styles.stageNote}>
                      Zaštita površina i definisanje zone rada pre lakiranja.
                    </p>
                  </div>
                </div>

                <div className={`${styles.stageCell} ${styles.stageCellSide}`}>
                  <p className={styles.stageCode}>Program</p>
                  <div>
                    {/* Wordmark već stoji u hero lockupu — ovde ide sadržaj, ne ponavljanje. */}
                    <p className={styles.stageLabel}>Ceo radni tok</p>
                    <p className={styles.stageNote}>
                      Priprema, reparacija, lakiranje i završna obrada u jednom programu.
                    </p>
                  </div>
                </div>

                <div className={`${styles.stageCell} ${styles.stageCellStrip}`}>
                  <p className={styles.stageCode}>Oblasti</p>
                  <p className={styles.stageLabel}>{carfitCategories.length}</p>
                </div>

                <div className={`${styles.stageCell} ${styles.stageCellStrip}`}>
                  <p className={styles.stageCode}>Poslovi</p>
                  <p className={styles.stageLabel}>{carfitTasks.length}</p>
                </div>

                <div className={`${styles.stageCell} ${styles.stageCellRow}`}>
                  <p className={styles.stageCode}>Faze</p>
                  <CarfitHeroMarkers markers={carfitHero.markers} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <BrandSectionNav
          ariaLabel="Brzi pristup Car Fit programu"
          items={carfitSectionNavItems}
        />

        {/* ----------------------------------------------- category index */}
        <section
          className={`${styles.section} ${styles.sectionOff} ${styles.gridSkin} ${styles.anchor}`}
          id="kategorije"
          aria-labelledby="carfit-categories-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.sectionHead}>
              <p className={styles.sectionKicker}>Kategorije</p>
              <h2 className={styles.sectionTitle} id="carfit-categories-title">
                Brzo do pravog proizvoda.
              </h2>
              <p className={styles.sectionLead}>
                Ako već znate šta tražite, uđite direktno kroz kategoriju — stvarna organizacija
                celog Car Fit programa. Pregled vodi na naš katalog sa odgovarajućim filterom.
              </p>
            </CarfitReveal>

            <CarfitReveal className={styles.categoryBoard} delay={60}>
              {categoryViews.map((category) => {
                const body = (
                  <>
                    <div>
                      <p className={styles.categoryCode}>{category.code}</p>
                      <h3 className={styles.categoryName}>{category.name}</h3>
                      <p className={styles.categoryNote}>{category.note}</p>
                    </div>
                    <div className={styles.categoryFoot}>
                      {category.count > 0 ? (
                        <span className={styles.categoryCount}>{category.count}</span>
                      ) : (
                        <span />
                      )}
                      {category.catalogTarget ? (
                        <span className={styles.categoryArrow} aria-hidden="true">
                          →
                        </span>
                      ) : null}
                    </div>
                  </>
                );

                return category.catalogTarget ? (
                  <Link
                    className={`${styles.category} ${styles.categoryLink}`}
                    href={category.catalogTarget.href}
                    key={category.id}
                  >
                    {body}
                  </Link>
                ) : (
                  <div className={styles.category} key={category.id}>
                    {body}
                  </div>
                );
              })}
            </CarfitReveal>
          </div>
        </section>

        {/* ------------------------------------------------- task selector */}
        <section
          className={`${styles.section} ${styles.sectionPaper} ${styles.anchor}`}
          id="poslovi"
          aria-labelledby="carfit-tasks-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.sectionHead}>
              <p className={styles.sectionKicker}>Poslovi</p>
              <h2 className={styles.sectionTitle} id="carfit-tasks-title">
                Radionica ne radi po kategorijama. Radi po zadacima.
              </h2>
              <p className={styles.sectionLead}>
                Zato {brand.name} program ne predstavljamo samo kao listu proizvoda. Počinjemo od
                posla koji treba završiti.
              </p>
            </CarfitReveal>

            <CarfitReveal delay={80}>
              <CarfitTaskSelector tasks={taskViews} />
            </CarfitReveal>
          </div>
        </section>

        {/* ---------------------------------------------- workbench zones */}
        <section
          className={`${styles.section} ${styles.sectionOff} ${styles.gridSkin} ${styles.anchor}`}
          id="program"
          aria-labelledby="carfit-workbench-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.sectionHead}>
              <p className={styles.sectionKicker}>Workbench</p>
              <h2 className={styles.sectionTitle} id="carfit-workbench-title">
                Jedan radni sto. Više poslova.
              </h2>
              <p className={styles.sectionLead}>
                Program je organizovan po zonama rada, onako kako se materijal stvarno uzima sa
                police — od pripreme do završne obrade.
              </p>
            </CarfitReveal>

            <CarfitReveal className={styles.zoneGrid} delay={60}>
              {carfitWorkbenchZones.map((zone) => (
                <article className={styles.zone} key={zone.id}>
                  <p className={styles.zoneCode}>{zone.code}</p>
                  <div>
                    <h3 className={styles.zoneTitle}>{zone.title}</h3>
                    <p className={styles.zoneLead}>{zone.lead}</p>
                  </div>
                  <ul className={styles.zoneItems}>
                    {zone.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </CarfitReveal>
          </div>
        </section>

        {/* -------------------------------------------- abrasive gradation */}
        <section
          className={`${styles.section} ${styles.sectionSteel} ${styles.gridSkin}`}
          aria-labelledby="carfit-gradation-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.sectionHead}>
              <p className={styles.sectionKicker}>{carfitAbrasiveStory.eyebrow}</p>
              <h2 className={styles.sectionTitle} id="carfit-gradation-title">
                {carfitAbrasiveStory.title}
              </h2>
              <p className={styles.sectionLead}>{carfitAbrasiveStory.lead}</p>
            </CarfitReveal>

            <CarfitReveal className={styles.gradationLayout} delay={60}>
              <ol className={styles.gradationSteps}>
                {carfitAbrasiveStory.steps.map((step) => (
                  <li className={styles.gradationStep} key={step.code}>
                    <span className={styles.gradationCode}>{step.code}</span>
                    <span>
                      <span className={styles.gradationTitle}>{step.title}</span>
                      <span className={styles.gradationNote}>{step.note}</span>
                    </span>
                  </li>
                ))}
              </ol>

              <div className={styles.gradationDisc} aria-hidden="true">
                <div className={styles.gradationDiscInner}>
                  <p className={styles.gradationDiscLabel}>Gradacija</p>
                  <p className={styles.gradationDiscValue}>P80 → P2000</p>
                </div>
              </div>
            </CarfitReveal>

            <p className={styles.footnote}>{carfitAbrasiveStory.note}</p>
          </div>
        </section>

        {/* -------------------------------------------------- family grid */}
        <section
          className={`${styles.section} ${styles.sectionPaper}`}
          aria-labelledby="carfit-families-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.sectionHead}>
              <p className={styles.sectionKicker}>Porodice</p>
              <h2 className={styles.sectionTitle} id="carfit-families-title">
                Proizvodi napravljeni za posao koji imaju.
              </h2>
              <p className={styles.sectionLead}>
                Svaka porodica pokriva jednu jasnu ulogu u procesu. Gde već imamo artikle u
                katalogu, modul vodi direktno na njih.
              </p>
            </CarfitReveal>

            <CarfitReveal className={styles.familyGrid} delay={60}>
              {familyViews.map((family) => {
                const spanClass =
                  family.span === "hero"
                    ? styles.familyHero
                    : family.span === "tall"
                      ? styles.familyTall
                      : family.span === "wide"
                        ? styles.familyWide
                        : styles.familyUnit;

                return (
                  <article className={`${styles.family} ${spanClass}`} key={family.id}>
                    <header className={styles.familyHead}>
                      <p className={styles.familyCode}>{family.code}</p>
                      <h3 className={styles.familyName}>{family.name}</h3>
                      <p className={styles.familyClaim}>{family.claim}</p>
                    </header>

                    <div className={styles.familyMedia}>
                      <CarfitMedia
                        mark={family.code}
                        sizes="(min-width: 64rem) 24vw, (min-width: 40rem) 46vw, 92vw"
                        slot={family.media}
                      />
                    </div>

                    <div className={styles.familyFoot}>
                      {family.count > 0 ? (
                        <span className={styles.familyCount}>
                          {family.count} u našem katalogu
                        </span>
                      ) : (
                        <span />
                      )}
                      {family.target ? (
                        <Link className={styles.btnLink} href={family.target.href}>
                          Katalog
                          <span aria-hidden="true">→</span>
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </CarfitReveal>
          </div>
        </section>

        {/* ------------------------------------------------- masking story */}
        <section
          className={`${styles.section} ${styles.sectionPaper}`}
          aria-labelledby="carfit-masking-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.storyRow}>
              <div>
                <p className={styles.sectionKicker}>{carfitMaskingStory.eyebrow}</p>
                <h2 className={styles.sectionTitle} id="carfit-masking-title">
                  {carfitMaskingStory.title}
                </h2>
                <p className={styles.sectionLead}>{carfitMaskingStory.lead}</p>

                <ol className={styles.calloutList}>
                  {carfitMaskingStory.callouts.map((callout) => (
                    <li className={styles.callout} key={callout.code}>
                      <span className={styles.calloutCode}>{callout.code}</span>
                      <span>
                        <span className={styles.calloutTitle}>{callout.title}</span>
                        <span className={styles.calloutNote}>{callout.note}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className={styles.storyMedia}>
                <CarfitMedia
                  mark="MASK"
                  sizes="(min-width: 48rem) 46vw, 92vw"
                  slot={carfitMaskingStory.media}
                />
              </div>
            </CarfitReveal>
          </div>
        </section>

        {/* -------------------------------------------------- finish story */}
        <section
          className={`${styles.section} ${styles.sectionSteel} ${styles.gridSkin}`}
          aria-labelledby="carfit-finish-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={`${styles.storyRow} ${styles.storyRowReverse}`}>
              <div>
                <p className={styles.sectionKicker}>{carfitFinishStory.eyebrow}</p>
                <h2 className={styles.sectionTitle} id="carfit-finish-title">
                  {carfitFinishStory.title}
                </h2>
                <p className={styles.sectionLead}>{carfitFinishStory.lead}</p>

                <ol className={styles.calloutList}>
                  {carfitFinishStory.system.map((item) => (
                    <li className={styles.callout} key={item.code}>
                      <span className={styles.calloutCode}>{item.code}</span>
                      <span>
                        <span className={styles.calloutTitle}>{item.title}</span>
                        <span className={styles.calloutNote}>{item.note}</span>
                      </span>
                    </li>
                  ))}
                </ol>

                <p className={styles.footnote}>
                  Black Label — premium linija paste i pribora za najzahtevnije poslove,
                  uz standardnu Red Label liniju za svakodnevni rad.
                </p>
              </div>

              <div className={styles.storyMedia}>
                <CarfitMedia
                  mark="FINISH"
                  sizes="(min-width: 48rem) 46vw, 92vw"
                  slot={carfitFinishStory.media}
                />
              </div>
            </CarfitReveal>
          </div>
        </section>

        {/* ------------------------------------------------------ products */}
        <section
          className={`${styles.section} ${styles.sectionPaper} ${styles.anchor}`}
          id="proizvodi"
          aria-labelledby="carfit-products-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.sectionHead}>
              <p className={styles.sectionKicker}>Katalog</p>
              <h2 className={styles.sectionTitle} id="carfit-products-title">
                {brand.name} proizvodi dostupni kod nas
              </h2>
              <p className={styles.sectionLead}>
                Artikli koji trenutno postoje u našem katalogu. Dostupnost i tehnički izbor
                potvrđuje tim Carsystem i R-M kroz upit.
              </p>
            </CarfitReveal>

            <CarfitReveal delay={60}>
              <CarfitProductShowcase products={productViews} />

              <div className={styles.showcaseFoot}>
                <p className={styles.footnote}>
                  Katalog se dopunjava. Poslovi bez direktno povezanog {brand.name} artikla vode na
                  odgovarajuću kategoriju kataloga.
                </p>
                <Link
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  href={carfitFinalCta.primaryCta.href}
                >
                  Pogledajte sve {brand.name} proizvode
                </Link>
              </div>
            </CarfitReveal>
          </div>
        </section>

        {/* ------------------------------------------------- documentation */}
        <section
          className={`${styles.section} ${styles.sectionOff} ${styles.gridSkin} ${styles.anchor}`}
          id="dokumentacija"
          aria-labelledby="carfit-docs-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.sectionHead}>
              <p className={styles.sectionKicker}>{carfitDocumentation.eyebrow}</p>
              <h2 className={styles.sectionTitle} id="carfit-docs-title">
                {carfitDocumentation.title}
              </h2>
              <p className={styles.sectionLead}>{carfitDocumentation.lead}</p>
            </CarfitReveal>

            <CarfitReveal className={styles.docGrid} delay={60}>
              {carfitDocumentation.items.map((item) => (
                <article className={styles.doc} key={item.code}>
                  <p className={styles.docCode}>{item.code}</p>
                  <h3 className={styles.docTitle}>{item.title}</h3>
                  <p className={styles.docNote}>{item.note}</p>
                </article>
              ))}
            </CarfitReveal>

            <div className={styles.showcaseFoot}>
              <p className={styles.footnote}>
                Dokumenti su vezani za stranicu pojedinačnog proizvoda. Ako dokument nije objavljen
                online, dostavljamo ga na upit.
              </p>
              <Link
                className={`${styles.btn} ${styles.btnSecondary}`}
                href={carfitFinalCta.secondaryCta.href}
              >
                Zatražite dokumentaciju
              </Link>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------- katalozi */}
        {carfitFeaturedDocuments.length > 0 ? (
          <section
            className={`${styles.section} ${styles.katalogSection}`}
            aria-labelledby="carfit-katalozi-title"
          >
            <div className={styles.container}>
              <CarfitReveal className={styles.sectionHead}>
                <p className={styles.sectionKicker}>Katalozi</p>
                <h2 className={styles.sectionTitle} id="carfit-katalozi-title">
                  Zvanični C.A.R.FIT katalog
                </h2>
                <p className={styles.sectionLead}>
                  Kompletan program u jednom PDF-u — kitovi, punioci, klar lakovi, aerosoli i pribor.
                </p>
              </CarfitReveal>

              <CarfitReveal className={styles.katalogGrid} delay={60}>
                {carfitFeaturedDocuments.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </CarfitReveal>

              <div className={styles.showcaseFoot}>
                <Link className={`${styles.btn} ${styles.btnSecondary}`} href="/katalozi?brand=carfit">
                  Svi C.A.R.FIT dokumenti
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* -------------------------------------------------- brand story */}
        <section
          className={`${styles.section} ${styles.sectionPaper}`}
          aria-labelledby="carfit-story-title"
        >
          <div className={styles.container}>
            <CarfitReveal className={styles.storyPanel}>
              <p className={styles.sectionKicker}>{carfitStory.eyebrow}</p>
              <h2 className={styles.sectionTitle} id="carfit-story-title">
                {carfitStory.title}
              </h2>
              <p className={styles.storyBody}>{carfitStory.body}</p>
              <div className={styles.storyMeta}>
                <span className={styles.storyMetaText}>{carfitStory.meta}</span>
                <span className={styles.storyTag}>{carfitStory.tag}</span>
              </div>
            </CarfitReveal>
          </div>
        </section>

        {/* ----------------------------------------------------- final cta */}
        <section
          className={`${styles.finalCta} ${styles.gridSkin} ${styles.gridSkinInvert}`}
          aria-labelledby="carfit-cta-title"
        >
          <div className={`${styles.container} ${styles.finalCtaInner}`}>
            <div className={styles.finalCtaCopy}>
              <h2 className={styles.finalCtaTitle} id="carfit-cta-title">
                {carfitFinalCta.title}
              </h2>
              <p className={styles.finalCtaBody}>{carfitFinalCta.body}</p>
              <div className={styles.finalCtaActions}>
                <Link
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  href={carfitFinalCta.primaryCta.href}
                >
                  {carfitFinalCta.primaryCta.label}
                </Link>
                <Link
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  href={carfitFinalCta.secondaryCta.href}
                >
                  {carfitFinalCta.secondaryCta.label}
                </Link>
              </div>
            </div>

            <div className={styles.finalCtaGrid} aria-hidden="true">
              {carfitWorkbenchZones.map((zone) => (
                <div className={styles.finalCtaCell} key={zone.id}>
                  <p className={styles.finalCtaCellCode}>{zone.code}</p>
                  <p className={styles.finalCtaCellLabel}>{zone.title}</p>
                  <p className={styles.finalCtaCellNote}>{zone.lead}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
