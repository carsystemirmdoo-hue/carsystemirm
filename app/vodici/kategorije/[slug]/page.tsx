import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { SavetiCard } from "@/components/saveti/SavetiCards";
import { SavetiNacrtTraka } from "@/components/saveti/SavetiNacrtTraka";
import styles from "@/components/saveti/Saveti.module.css";
import { getPublicSaveti, MIN_CLANAKA_ZA_INDEKS_KATEGORIJE, savetiNacrtPregled, toSazetak } from "@/lib/saveti";
import { getSavetiKategorija, SAVETI_KATEGORIJE } from "@/lib/saveti/kategorije.mjs";
import { breadcrumbJsonLd, collectionPageJsonLd, jsonLd, pageMetadata } from "@/lib/seo";

/**
 * Tematska celina. Strana postoji tek kada tema ima bar jedan javan članak,
 * a indeksabilna je tek od MIN_CLANAKA_ZA_INDEKS_KATEGORIJE članaka — tanka
 * lista od jednog linka nije strana koja zaslužuje mesto u indeksu.
 */
export const revalidate = 3600;
export const dynamicParams = true;

type RouteProps = { params: Promise<{ slug: string }> };

function articlesFor(slug: string) {
  return getPublicSaveti().filter((clanak) => clanak.kategorija === slug && clanak.tip !== "novost");
}

export function generateStaticParams() {
  return SAVETI_KATEGORIJE.filter((kategorija) => kategorija.slug !== "novosti" && articlesFor(kategorija.slug).length).map(
    (kategorija) => ({ slug: kategorija.slug }),
  );
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const kategorija = getSavetiKategorija(slug);
  const articles = articlesFor(slug);
  if (!kategorija || slug === "novosti" || !articles.length) return {};
  return pageMetadata({
    title: `${kategorija.naziv} — saveti i vodiči`,
    description: kategorija.opis,
    path: `/vodici/kategorije/${slug}`,
    index: articles.length >= MIN_CLANAKA_ZA_INDEKS_KATEGORIJE && !savetiNacrtPregled(),
    imageAlt: kategorija.naziv,
  });
}

export default async function KategorijaPage({ params }: RouteProps) {
  const { slug } = await params;
  const kategorija = getSavetiKategorija(slug);
  if (!kategorija || slug === "novosti") notFound();
  const articles = articlesFor(slug);
  if (!articles.length) notFound();

  const route = `/vodici/kategorije/${slug}`;
  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Saveti i vodiči", path: "/vodici" },
    { name: kategorija.naziv, path: route },
  ];
  // Osnovni vodiči prvo — oni su ulaz u temu; ostalo po datumu objave.
  const ordered = [
    ...articles.filter((clanak) => clanak.tip === "osnovni-vodic"),
    ...articles.filter((clanak) => clanak.tip !== "osnovni-vodic"),
  ].map(toSazetak);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          collectionPageJsonLd({
            name: kategorija.naziv,
            description: kategorija.opis,
            path: route,
            itemUrls: ordered.map((clanak) => `/vodici/${clanak.slug}`),
          }),
        )}
      />
      <main className={styles.pageWithCrumbs}>
        <SavetiNacrtTraka />
        <SeoBreadcrumbs items={breadcrumbs} />
        <div className={styles.container}>
          <header className={styles.hero}>
            <p className={styles.eyebrow}>Saveti i vodiči</p>
            <h1 className={styles.title}>{kategorija.naziv}</h1>
            <p className={styles.intro}>{kategorija.opis}</p>
          </header>
          <div className={styles.grid}>
            {ordered.map((clanak) => (
              <SavetiCard key={clanak.slug} clanak={clanak} showCategory={false} />
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
