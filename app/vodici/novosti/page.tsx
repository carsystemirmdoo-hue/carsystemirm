import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { SavetiNewsItem } from "@/components/saveti/SavetiCards";
import styles from "@/components/saveti/Saveti.module.css";
import { getPublicSaveti, toSazetak } from "@/lib/saveti";
import { breadcrumbJsonLd, collectionPageJsonLd, jsonLd, pageMetadata } from "@/lib/seo";

/** Novosti proizvođača — ista kapija i isti ISR kao ostatak rubrike. */
export const revalidate = 3600;

const TITLE = "Novosti proizvođača";
const DESCRIPTION =
  "Proverene novosti proizvođača iz našeg programa, sa datumom događaja, tržištem na koje se odnose i napomenom o dostupnosti u Srbiji.";

export async function generateMetadata(): Promise<Metadata> {
  const news = getPublicSaveti().filter((clanak) => clanak.tip === "novost");
  return pageMetadata({
    title: TITLE,
    description: DESCRIPTION,
    path: "/vodici/novosti",
    index: news.length > 0,
    imageAlt: "Novosti proizvođača — Carsystem i R-M",
  });
}

export default function NovostiPage() {
  const news = getPublicSaveti()
    .filter((clanak) => clanak.tip === "novost")
    .map(toSazetak);
  const breadcrumbs = [
    { name: "Početna", path: "/" },
    { name: "Saveti i vodiči", path: "/vodici" },
    { name: "Novosti", path: "/vodici/novosti" },
  ];

  return (
    <>
      {news.length ? (
        <>
          <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbJsonLd(breadcrumbs))} />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={jsonLd(
              collectionPageJsonLd({
                name: TITLE,
                description: DESCRIPTION,
                path: "/vodici/novosti",
                itemUrls: news.map((clanak) => `/vodici/${clanak.slug}`),
              }),
            )}
          />
        </>
      ) : null}
      <main className={styles.page}>
        <div className={styles.container}>
          <SeoBreadcrumbs items={breadcrumbs} />
          <header className={styles.hero} style={{ marginTop: 24 }}>
            <p className={styles.eyebrow}>Saveti i vodiči</p>
            <h1 className={styles.title}>Novosti</h1>
            <p className={styles.intro}>
              Novosti proizvođača iz našeg programa. Uz svaku vest navodimo datum događaja i tržište na koje
              se odnosi. Globalna objava ne znači da je proizvod dostupan u Srbiji — kada dostupnost nije
              potvrđena, to piše uz vest.
            </p>
          </header>
          {news.length ? (
            <div className={styles.newsList}>
              {news.map((clanak) => (
                <SavetiNewsItem key={clanak.slug} clanak={clanak} />
              ))}
            </div>
          ) : (
            <p className={styles.empty}>
              Još nema objavljenih novosti. <Link href="/vodici">Pogledajte savete i vodiče</Link>.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
