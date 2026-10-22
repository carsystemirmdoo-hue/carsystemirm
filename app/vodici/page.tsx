import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SavetiNewsItem } from "@/components/saveti/SavetiCards";
import { SavetiExplorer } from "@/components/saveti/SavetiExplorer";
import { SavetiNacrtTraka } from "@/components/saveti/SavetiNacrtTraka";
import styles from "@/components/saveti/Saveti.styles";
import { getPublicKategorije, getPublicNovosti, getPublicSaveti, savetiNacrtPregled, toSazetak } from "@/lib/saveti";
import { breadcrumbJsonLd, collectionPageJsonLd, jsonLd, pageMetadata } from "@/lib/seo";

/**
 * Početna rubrike „Saveti i vodiči“.
 *
 * Strana se generiše statički i obnavlja najkasnije na sat vremena (ISR), a
 * zakazani posao je dodatno osvežava u trenutku termina. Spisak se računa
 * kapijom objave za trenutak generisanja, pa budući članak ne može da se
 * pojavi pre svog termina ni kada je već u buildu.
 *
 * Dok nema nijednog objavljenog teksta, strana je `noindex` i nije u sitemapu.
 */
export const revalidate = 3600;

const TITLE = "Saveti i vodiči za auto lakiranje";
const DESCRIPTION =
  "Stručni vodiči o pripremi površine, materijalima, opremi, sušenju i greškama pri lakiranju, uz proverene novosti proizvođača iz našeg programa.";

export async function generateMetadata(): Promise<Metadata> {
  const published = getPublicSaveti();
  return pageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: "/vodici",
    index: published.length > 0 && !savetiNacrtPregled(),
    imageAlt: "Carsystem i R-M saveti i vodiči",
  });
}

export default function SavetiIndexPage() {
  const published = getPublicSaveti();
  const news = getPublicNovosti(published).slice(0, 3).map(toSazetak);
  const guides = published.filter((clanak) => clanak.tip !== "novost");
  const categories = getPublicKategorije(guides);
  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Saveti i vodiči", path: "/vodici" },
  ];

  return (
    <>
      {published.length ? (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLd(
              collectionPageJsonLd({
                name: TITLE,
                description: DESCRIPTION,
                path: "/vodici",
                itemUrls: published.slice(0, 30).map((clanak) => `/vodici/${clanak.slug}`),
              }),
            )}
          />
        </>
      ) : null}
      <main className={styles.page}>
        <SavetiNacrtTraka />
        <div className={styles.container}>
          <header className={styles.hero}>
            <p className={styles.eyebrow}>Stručna biblioteka</p>
            <h1 className={styles.title}>Saveti i vodiči</h1>
            <p className={styles.intro}>
              Objašnjenja i postupci za pripremu površine, materijale, opremu, sušenje i greške pri
              lakiranju. Tehnički podaci su navedeni uz izvor i verziju dokumenta proizvođača, a novosti
              nose datum događaja i napomenu o dostupnosti u Srbiji.
            </p>
          </header>

          {!published.length ? (
            <section className={styles.section}>
              <p className={styles.intro}>
                Prvi tekstovi su u pripremi. Objavljujemo ih tek kada prođu tehničku i jezičku proveru i
                kada ih odobri naš tim. Do tada nas za konkretno pitanje o proizvodu ili postupku možete
                kontaktirati direktno.
              </p>
              <div className={styles.ctaRow}>
                <Link className={styles.ctaPrimary} href="/kontakt?tema=tehnicka-podrska">
                  Pitajte tehničku podršku
                </Link>
                <Link className={styles.ctaSecondary} href="/katalog">
                  Katalog proizvoda
                </Link>
              </div>
            </section>
          ) : null}

          {news.length ? (
            <section className={styles.section} aria-labelledby="novosti-naslov">
              <div className={styles.sectionHead}>
                <h2 id="novosti-naslov" className={styles.sectionHeading}>
                  Novosti
                </h2>
                <Link className={styles.sectionLink} href="/vodici/novosti">
                  Sve novosti →
                </Link>
              </div>
              <div className={styles.newsList}>
                {news.map((clanak) => (
                  <SavetiNewsItem key={clanak.slug} clanak={clanak} />
                ))}
              </div>
            </section>
          ) : null}

          {categories.length ? (
            <section className={styles.section} aria-labelledby="teme-naslov">
              <div className={styles.sectionHead}>
                <h2 id="teme-naslov" className={styles.sectionHeading}>
                  Teme
                </h2>
              </div>
              <nav className={styles.categoryGrid} aria-label="Teme saveta i vodiča">
                {categories.map((kategorija) => (
                  <Link key={kategorija.slug} className={styles.categoryLink} href={`/vodici/kategorije/${kategorija.slug}`}>
                    <span>{kategorija.naziv}</span>
                    <span className={styles.categoryCount}>{kategorija.broj}</span>
                  </Link>
                ))}
              </nav>
            </section>
          ) : null}

          {guides.length ? (
            <section className={styles.section} aria-labelledby="svi-naslov">
              <div className={styles.sectionHead}>
                <h2 id="svi-naslov" className={styles.sectionHeading}>
                  Svi vodiči
                </h2>
              </div>
              <SavetiExplorer
                articles={guides.map(toSazetak)}
                categories={categories.map(({ slug, naziv, broj }) => ({ slug, naziv, broj }))}
              />
            </section>
          ) : null}
        </div>
      </main>
      <Footer />
    </>
  );
}
