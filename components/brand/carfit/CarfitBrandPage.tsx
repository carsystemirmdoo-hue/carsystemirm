import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { FrameThemeBoot } from "@/components/theme/FrameThemeBoot";
import {
  carfitAbrasiveStory,
  carfitCategories,
  carfitDocumentation,
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
import { BrandSectionNav } from "@/components/brand/BrandSectionNav";
import { CarfitMedia } from "./CarfitMedia";
import { CarfitReveal } from "./CarfitReveal";
import { CarfitTaskSelector } from "./CarfitTaskSelector";
import type { CarfitProductView, CarfitTaskView } from "./carfit-view";
import { DocumentCard } from "@/components/documents/DocumentCard";
import { getFeaturedDocuments } from "@/lib/documents";
import styles from "./CarfitBrandPage.styles";
import { toDisplayImageSrc } from "@/lib/productImageDisplay";
import { getCarfitAbrasives } from "@/lib/carfit-abrasives";

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

/** Fotografije stvarnih proizvoda iz datih kategorija (bez ponavljanja), za polja bez scenske fotografije. */
function categoryShots(categoryIds: string[], limit: number) {
  const shots: { src: string; alt: string }[] = [];
  const seen = new Set<string>();
  for (const id of categoryIds) {
    const category = getCarfitCategoryById(id);
    if (!category) continue;
    for (const product of resolveCarfitProducts(category, 24)) {
      const image = realImage(product);
      if (!image || seen.has(product.slug) || shots.length >= limit) continue;
      seen.add(product.slug);
      shots.push({ src: toDisplayImageSrc(image.src), alt: image.alt || product.name });
    }
  }
  return shots;
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
    image: image ? { src: toDisplayImageSrc(image.src), alt: image.alt } : null,
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

/* Reprezentativni izbor (2026-10-19): po jedan proizvod iz svake grupe programa. */
const REPRESENTATIVE = [
  { slug: "carfit-silicone-remover-strawberry", group: "Čišćenje" },
  { slug: "carfit-purple-ceramic-film", group: "Abrazivi" },
  { slug: "carfit-multi-soft-putty", group: "Kitovi" },
  { slug: "carfit-perfect-filler-4-1-grey", group: "Punioci" },
  { slug: "carfit-masking-film-with-electrostatic-effect", group: "Maskiranje" },
  { slug: "carfit-cover-tape-water-resistant-up-to-120c", group: "Trake" },
  { slug: "carfit-2k-hs-perfect-clear", group: "Bezbojni lak" },
  { slug: "carfit-universal-polishing-compound", group: "Poliranje" },
] as const;

export function CarfitBrandPage({ brand }: { brand: CarsystemBrand }) {
  const wordmark = brand.wordmark ?? brand.name;
  const products = getCarfitProducts();
  const productViews = products.map(toProductView);
  const taskViews = buildTaskViews();
  const abrasives = getCarfitAbrasives();
  const viewBySlug = new Map(productViews.map((view) => [view.slug, view]));
  const representative = REPRESENTATIVE.flatMap(({ slug, group }) => {
    const product = viewBySlug.get(slug);
    return product ? [{ product, group }] : [];
  });

  const categoryViews = carfitCategories.map((category) => ({
    ...category,
    count: resolveCarfitProducts(category, 99).length,
  }));

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
          // Hero je uvek grafitni: okvir sajta (header, meniji) ga prati.
          data-frame-theme="dark"
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
                  {wordmark}
                </li>
              </ol>
            </div>
          </nav>

          {/* Uvodni blok: zvanična C.A.R.FIT fotografija već nosi logo i proizvode,
              pa se preko nje ništa ne postavlja; tekst i akcije su ispod. Od
              2026-10-20 ide preko cele širine ekrana (bez containera). */}
          <div className={styles.heroPhotoWrap}>
            <div className={styles.heroPhoto}>
              <Image
                alt={`${wordmark} REBEL FLAIR — logo i asortiman: lakovi, punioci, trake, papir i brusni diskovi`}
                fill
                priority
                sizes="100vw"
                src="/images/brands/carfit/hero/carfit-rebel-flair-asortiman-3155x1329.jpg"
              />
            </div>
          </div>

          <div className={`${styles.container} ${styles.heroBelow}`}>
            <div>
              <p className={styles.heroEyebrow}>{carfitHero.eyebrow}</p>
              <h1 className={styles.heroTitle} id="carfit-title">
                {carfitHero.title}
              </h1>
            </div>
            <div className={styles.heroBelowAside}>
              <p className={styles.heroLead}>{carfitHero.lead}</p>
              <div className={styles.heroActions}>
                <Link
                  className={`${styles.btn} ${styles.btnPrimary} cs-cta`}
                  data-cta-on="dark"
                  href={carfitFinalCta.primaryCta.href}
                >
                  Pogledajte sve C.A.R.FIT proizvode
                </Link>
                <a
                  className={`${styles.btn} ${styles.btnSecondary} cs-cta`}
                  data-cta-on="dark"
                  href="#poslovi"
                >
                  Izbor po poslu
                </a>
              </div>
            </div>
          </div>
        </section>
        <FrameThemeBoot />

        <BrandSectionNav
          ariaLabel="Brzi pristup C.A.R.FIT programu"
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
                celog C.A.R.FIT programa. Pregled vodi na naš katalog sa odgovarajućim filterom.
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
                Zato C.A.R.FIT program ne predstavljamo samo kao listu proizvoda. Počinjemo od
                posla koji treba završiti.
              </p>
            </CarfitReveal>

            <CarfitReveal delay={80}>
              <CarfitTaskSelector tasks={taskViews} />
            </CarfitReveal>
          </div>
        </section>

        {/* ------------------------------------------------------ abrazivi */}
        <section
          className={`${styles.section} ${styles.sectionSteel} ${styles.anchor}`}
          id="abrazivi"
          aria-labelledby="carfit-gradation-title"
        >
          <div className={styles.container}>
            {/* Blok gradacije (2026-10-20): umesto skale ide stvarna fotografija
                brušenja iz zvaničnog C.A.R.FIT kataloga 2026 (uvodna strana
                poglavlja Abrasives). Rasponi su po proizvodu, iz tabela
                varijanti na carfitrepair.com — nisu opšta preporuka. */}
            <div className={styles.abrasiveLayout}>
              <figure className={styles.abrasivePhoto}>
                <Image
                  alt="Ručno brušenje panela brusnim blokom u radionici, ruke u nitrilnim rukavicama"
                  fill
                  sizes="(min-width: 64rem) 40vw, 100vw"
                  src="/images/brands/carfit/primena/carfit-brusenje-blokom-983x1435.jpg"
                />
                <figcaption>Fotografija: C.A.R.FIT katalog 2026</figcaption>
              </figure>

              <div className={styles.abrasiveBody}>
                <CarfitReveal className={styles.sectionHead}>
                  <p className={styles.sectionKicker}>{carfitAbrasiveStory.eyebrow}</p>
                  <h2 className={styles.sectionTitle} id="carfit-gradation-title">
                    {carfitAbrasiveStory.title}
                  </h2>
                  <p className={styles.sectionLead}>
                    Pet C.A.R.FIT abraziva iz našeg programa, svaki sa svojom namenom.
                    Uz svaki je raspon granulacija u kojem ga proizvođač nudi.
                  </p>
                </CarfitReveal>

                <ol className={styles.abrasiveList}>
                  {abrasives.map((abrasive) => (
                    <li className={styles.abrasive} key={abrasive.slug}>
                      <Link className={styles.abrasiveLink} href={`/proizvodi/${abrasive.slug}`}>
                        <span className={styles.abrasiveImage}>
                          {abrasive.image ? (
                            <Image
                              alt=""
                              fill
                              sizes="4.5rem"
                              src={toDisplayImageSrc(abrasive.image)}
                            />
                          ) : null}
                        </span>
                        <span className={styles.abrasiveCopy}>
                          <span className={styles.abrasiveName}>{abrasive.name}</span>
                          <span className={styles.abrasiveSubtype}>{abrasive.subtype}</span>
                          <span className={styles.abrasivePurpose}>{abrasive.purpose}</span>
                        </span>
                        <span className={styles.abrasiveRangeLabel}>
                          P{abrasive.gritMin} – P{abrasive.gritMax}
                          <small>{abrasive.gritCount} granulacija</small>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>

                <p className={styles.footnote}>
                  Raspon je ono što proizvođač nudi za taj proizvod (tabele varijanti na
                  carfitrepair.com), ne preporuka za korak. Proizvođač ne objavljuje koja
                  granulacija ide u koji korak — izbor za konkretan posao potvrđujemo kroz
                  upit.
                </p>
                <Link
                  className={`${styles.btn} ${styles.btnSecondary} cs-cta`}
                  href="/katalog?brend=carfit&program=priprema-i-abrazivi"
                >
                  C.A.R.FIT priprema i abrazivi u katalogu
                </Link>
              </div>
            </div>
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
                  products={carfitMaskingStory.media.src ? undefined : categoryShots(["maskiranje"], 3)}
                  mark="Maskiranje"
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
                  products={carfitFinishStory.media.src ? undefined : categoryShots(["poliranje"], 3)}
                  mark="Završna obrada"
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
                Po jedan proizvod iz svake grupe.
              </h2>
              <p className={styles.sectionLead}>
                Reprezentativan izbor za upoznavanje programa. Dostupnost i tehnički izbor
                potvrđuje tim Carsystem i R-M kroz upit.
              </p>
            </CarfitReveal>

            <CarfitReveal delay={60}>
              <ul className={styles.repGrid}>
                {representative.map(({ product, group }) => (
                  <li key={product.slug}>
                    <Link className={styles.repCard} href={product.href}>
                      <span className={styles.repImage}>
                        {product.image ? (
                          <Image
                            alt={product.image.alt}
                            fill
                            sizes="(min-width: 64rem) 22vw, (min-width: 40rem) 44vw, 90vw"
                            src={product.image.src}
                          />
                        ) : null}
                      </span>
                      <span className={styles.repGroup}>{group}</span>
                      <span className={styles.repName}>{product.name.replace(/^Car Fit\s+/i, "")}</span>
                      <span className={styles.repMore}>
                        Otvorite proizvod <span aria-hidden="true">→</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              <div className={styles.showcaseFoot}>
                <p className={styles.footnote}>
                  Ovo je izbor po grupama. Ceo C.A.R.FIT asortiman ({productViews.length}{" "}
                  proizvoda) je u katalogu, već filtriran na C.A.R.FIT.
                </p>
                <Link
                  className={`${styles.btn} ${styles.btnPrimary} cs-cta`}
                  data-cta-on="theme"
                  data-cta-fill="red"
                  href={carfitFinalCta.primaryCta.href}
                >
                  Pogledajte sve C.A.R.FIT proizvode
                  <span aria-hidden="true">→</span>
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
                className={`${styles.btn} ${styles.btnSecondary} cs-cta`} data-cta-on="theme"
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
                  Kompletan program u jednom PDF-u — kitovi, punioci, bezbojni lakovi, aerosoli i pribor.
                </p>
              </CarfitReveal>

              <CarfitReveal className={styles.katalogGrid} delay={60}>
                {carfitFeaturedDocuments.map((document) => (
                  <DocumentCard key={document.id} document={document} />
                ))}
              </CarfitReveal>

              <div className={styles.showcaseFoot}>
                <Link className={`${styles.btn} ${styles.btnSecondary} cs-cta`} data-cta-on="theme" href="/katalozi?brend=carfit">
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
                  className={`${styles.btn} ${styles.btnPrimary} cs-cta`} data-cta-on="dark"
                  href={carfitFinalCta.primaryCta.href}
                >
                  {carfitFinalCta.primaryCta.label}
                </Link>
                <Link
                  className={`${styles.btn} ${styles.btnSecondary} cs-cta`} data-cta-on="dark"
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
