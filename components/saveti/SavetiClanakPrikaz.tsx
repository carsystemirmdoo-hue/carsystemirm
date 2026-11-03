import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { SavetiBody, SavetiLead } from "@/components/saveti/SavetiBody";
import { SavetiCard } from "@/components/saveti/SavetiCards";
import styles from "@/components/saveti/Saveti.styles";
import { getAllCarsystemBrands, getCarsystemProductBySlug } from "@/lib/carsystem-data";
import { getProductFamilyBySlug } from "@/lib/product-families";
import { getRelatedSaveti, publicSlugSet, toSazetak, type SavetiClanak } from "@/lib/saveti";
import { getSavetiKategorija, SAVETI_TIPOVI } from "@/lib/saveti/kategorije.mjs";
import { formatSerbianDate } from "@/lib/saveti/vreme.mjs";
import { inlineText } from "@/lib/saveti/markdown.mjs";
import { absoluteUrl, breadcrumbJsonLd, jsonLd, siteConfig } from "@/lib/seo";
import { programiZaVodic } from "@/lib/sistemi/content";

function productCards(clanak: SavetiClanak) {
  const brands = new Map(getAllCarsystemBrands().map((brand) => [brand.slug, brand.name]));
  return clanak.proizvodi
    .map((reference) => {
      if (reference.startsWith("grupa:")) {
        const family = getProductFamilyBySlug(reference.slice(6));
        return family
          ? { href: `/proizvodi/grupa/${family.slug}`, name: family.name, brand: brands.get(family.brandSlug) ?? "" }
          : undefined;
      }
      const product = getCarsystemProductBySlug(reference);
      return product
        ? { href: `/proizvodi/${product.slug}`, name: product.name, brand: brands.get(product.brandSlug) ?? "" }
        : undefined;
    })
    .filter((item): item is { href: string; name: string; brand: string } => Boolean(item));
}

function sourceLine(source: SavetiClanak["izvori"][number]) {
  const parts = [source.naziv];
  if (source.verzija) parts.push(`verzija ${source.verzija}`);
  if (source.datumIzvora) parts.push(`datum izvora ${formatSerbianDate(source.datumIzvora)}`);
  return parts.join(", ");
}

/**
 * Prikaz članka — isti za javnu stranu i za pregled iz poslovnog panela (`pregled`).
 * U pregledu nema strukturiranih podataka za pretraživače i iznad članka stoji traka nacrta.
 */
export function SavetiClanakPrikaz({
  clanak,
  published,
  pregled,
}: {
  clanak: SavetiClanak;
  published: SavetiClanak[];
  pregled?: { oznaka: string; opis: string; neobjavljen?: boolean };
}) {
  const publicSlugs = publicSlugSet(published);
  const related = getRelatedSaveti(clanak, published).map(toSazetak);
  const kategorija = getSavetiKategorija(clanak.kategorija);
  const tip = (SAVETI_TIPOVI as Record<string, string>)[clanak.tip];
  const sourceNumbers = new Map(clanak.izvori.map((source, index) => [source.id, index + 1]));
  const products = productCards(clanak);
  const programi = programiZaVodic(clanak.slug);
  const toc = clanak.blocks.filter((block) => block.t === "h" && block.level === 2) as Extract<
    SavetiClanak["blocks"][number],
    { t: "h" }
  >[];
  const route = `/vodici/${clanak.slug}`;
  const updated = clanak.datumIzmene !== clanak.datumObjave;

  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Saveti i vodiči", path: "/vodici" },
    clanak.tip === "novost"
      ? { name: "Novosti", path: "/vodici/novosti" }
      : { name: kategorija?.naziv ?? "Tema", path: `/vodici/kategorije/${clanak.kategorija}` },
    { name: clanak.naslov, path: route },
  ];

  /*
   * Article/NewsArticle prema stvarnom sadržaju. Autor je firma koja tekst
   * objavljuje i odobrava — pojedinačni autor se ne izmišlja. FAQPage se ne
   * koristi: Google više ne prikazuje FAQ rezultate za ovakve sajtove.
   */
  const articleNode = {
    "@context": "https://schema.org",
    "@type": clanak.tip === "novost" ? "NewsArticle" : "Article",
    "@id": `${absoluteUrl(route)}#article`,
    headline: clanak.naslov,
    description: clanak.opis,
    url: absoluteUrl(route),
    mainEntityOfPage: absoluteUrl(route),
    inLanguage: siteConfig.language,
    datePublished: clanak.datumObjave,
    dateModified: clanak.datumIzmene,
    articleSection: kategorija?.naziv,
    wordCount: clanak.reci,
    image: absoluteUrl(clanak.slika ? `/vodici/slike/${clanak.slika.id}` : siteConfig.defaultOgImage),
    author: { "@id": `${absoluteUrl("/")}#organization` },
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    citation: clanak.izvori
      .filter((source) => source.url)
      .map((source) => ({ "@type": "CreativeWork", name: source.naziv, url: source.url })),
  };

  return (
    <>
      {pregled ? null : (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))} />
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleNode)} />
        </>
      )}
      <main className={styles.pageWithCrumbs}>
        {pregled ? (
          <div className={styles.nacrtTraka} role="note">
            <strong>{pregled.oznaka}</strong> {pregled.opis}
          </div>
        ) : null}
        <SeoBreadcrumbs items={breadcrumbs} />
        <div className={styles.container}>
          <div className={styles.articleLayout}>
            <article className={styles.articleMain}>
              <header className={styles.articleHeader}>
                <p className={styles.eyebrow}>
                  {clanak.tip === "novost" ? (
                    <Link href="/vodici/novosti">Novosti</Link>
                  ) : (
                    <Link href={`/vodici/kategorije/${clanak.kategorija}`}>{kategorija?.naziv}</Link>
                  )}
                  {" · "}
                  {tip}
                </p>
                <h1 className={styles.title}>{clanak.naslov}</h1>
                {clanak.slika ? (
                  <figure className={styles.cover}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- slika iz baze, već sažeta u WebP */}
                    <img
                      src={`/vodici/slike/${clanak.slika.id}`}
                      alt={clanak.slika.alt}
                      width={clanak.slika.sirina}
                      height={clanak.slika.visina}
                      decoding="async"
                    />
                  </figure>
                ) : null}
                {clanak.tip === "novost" ? (
                  <div className={styles.badges}>
                    {clanak.istorijska ? (
                      <span className={styles.badge} data-tone="accent">
                        Istorijska vest
                      </span>
                    ) : null}
                    {clanak.dostupnostUSrbiji === "nije-potvrdjena" ? (
                      <span className={styles.badge}>Dostupnost u Srbiji nije potvrđena</span>
                    ) : null}
                  </div>
                ) : null}
                <dl className={styles.facts}>
                  {clanak.tip === "novost" && clanak.datumDogadjaja ? (
                    <>
                      <dt>Datum događaja</dt>
                      <dd>
                        <time dateTime={clanak.datumDogadjaja}>{formatSerbianDate(clanak.datumDogadjaja)}</time>
                      </dd>
                    </>
                  ) : null}
                  {clanak.tip === "novost" && clanak.trziste ? (
                    <>
                      <dt>Tržište</dt>
                      <dd>{clanak.trziste}</dd>
                    </>
                  ) : null}
                  {pregled?.neobjavljen ? (
                    <>
                      <dt>Objava</dt>
                      <dd>Nije objavljeno (pregled nacrta)</dd>
                    </>
                  ) : (
                    <>
                      <dt>Objavljeno</dt>
                      <dd>
                        <time dateTime={clanak.datumObjave}>{formatSerbianDate(clanak.datumObjave)}</time>
                      </dd>
                    </>
                  )}
                  {updated && !pregled?.neobjavljen ? (
                    <>
                      <dt>Ažurirano</dt>
                      <dd>
                        <time dateTime={clanak.datumIzmene}>{formatSerbianDate(clanak.datumIzmene)}</time>
                      </dd>
                    </>
                  ) : null}
                  {clanak.poslednjaProvera ? (
                    <>
                      <dt>Izvori provereni</dt>
                      <dd>
                        <time dateTime={clanak.poslednjaProvera}>{formatSerbianDate(clanak.poslednjaProvera)}</time>
                      </dd>
                    </>
                  ) : null}
                </dl>
                <SavetiLead blocks={clanak.blocks} sourceNumbers={sourceNumbers} publicSlugs={publicSlugs} />
              </header>

              {toc.length >= 3 ? (
                <details className={styles.tocMobile}>
                  <summary>Sadržaj</summary>
                  <ol>
                    {toc.map((heading) => (
                      <li key={heading.id}>
                        <a href={`#${heading.id}`}>{inlineText(heading.c)}</a>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}

              <SavetiBody blocks={clanak.blocks} sourceNumbers={sourceNumbers} publicSlugs={publicSlugs} skipLead />

              {products.length ? (
                <section className={styles.block} aria-labelledby="proizvodi-naslov">
                  <h2 id="proizvodi-naslov" className={styles.blockHeading}>
                    Proizvodi iz kataloga
                  </h2>
                  <div className={styles.products}>
                    {products.map((product) => (
                      <div key={product.href} className={styles.product}>
                        <span className={styles.productBrand}>{product.brand}</span>
                        <span className={styles.productName}>
                          <Link href={product.href}>{product.name}</Link>
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className={styles.note} style={{ marginTop: 12 }}>
                    Pre rada proverite aktuelni tehnički list konkretnog proizvoda; podaci važe za navedenu
                    verziju dokumenta.
                  </p>
                </section>
              ) : null}

              <section className={styles.block} aria-labelledby="izvori-naslov">
                <h2 id="izvori-naslov" className={styles.blockHeading}>
                  Izvori
                </h2>
                <ol className={styles.sources}>
                  {clanak.izvori.map((source) => (
                    <li key={source.id} id={`izvor-${source.id}`}>
                      {source.url ? (
                        <a href={source.url} rel="noopener noreferrer" target="_blank">
                          {sourceLine(source)}
                        </a>
                      ) : source.dokument ? (
                        <a href={source.dokument}>{sourceLine(source)}</a>
                      ) : (
                        sourceLine(source)
                      )}
                      {` — pristupljeno ${formatSerbianDate(source.pristupljeno)}`}
                      {source.napomena ? `. ${source.napomena}` : ""}
                    </li>
                  ))}
                </ol>
                <p className={styles.note} style={{ marginTop: 16 }}>
                  Tekst je pripremljen na osnovu navedenih izvora. Opšti saveti ne zamenjuju uputstvo
                  proizvođača za konkretan proizvod.
                </p>
              </section>

              {programi.length ? (
                <section className={styles.block} aria-labelledby="programi-naslov">
                  <h2 id="programi-naslov" className={styles.blockHeading}>
                    Na stranicama programa
                  </h2>
                  <div className={styles.products}>
                    {programi.map((veza) => (
                      <div key={`${veza.href}-${veza.naslov}`} className={styles.product}>
                        <span className={styles.productBrand}>
                          {veza.program} · {veza.odeljak}
                        </span>
                        <span className={styles.productName}>
                          <Link href={veza.href}>{veza.naslov}</Link>
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className={styles.block} aria-labelledby="pomoc-naslov">
                <h2 id="pomoc-naslov" className={styles.blockHeading}>
                  Potrebna Vam je pomoć oko materijala?
                </h2>
                <p className={styles.note}>
                  Partnerske prodavnice i naša tehnička podrška pomažu u izboru proizvoda za Vašu podlogu i
                  uslove rada.
                </p>
                <div className={styles.ctaRow}>
                  <Link className={styles.ctaPrimary} href="/prodavnice">
                    Pronađite najbližu prodavnicu
                  </Link>
                  <Link className={styles.ctaSecondary} href="/kontakt?tema=tehnicka-podrska">
                    Pitajte tehničku podršku
                  </Link>
                </div>
              </section>

              {related.length ? (
                <section className={styles.block} aria-labelledby="povezani-naslov">
                  <h2 id="povezani-naslov" className={styles.blockHeading}>
                    Povezani vodiči
                  </h2>
                  <div className={styles.grid}>
                    {related.map((item) => (
                      <SavetiCard key={item.slug} clanak={item} />
                    ))}
                  </div>
                </section>
              ) : null}
            </article>

            {toc.length >= 3 ? (
              <aside className={styles.aside} aria-label="Sadržaj članka">
                <div className={styles.asideInner}>
                  <nav className={styles.toc}>
                    <p className={styles.eyebrow}>Sadržaj</p>
                    <ol>
                      {toc.map((heading) => (
                        <li key={heading.id}>
                          <a href={`#${heading.id}`}>{inlineText(heading.c)}</a>
                        </li>
                      ))}
                    </ol>
                  </nav>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
