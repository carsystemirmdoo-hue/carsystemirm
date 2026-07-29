import Link from "next/link";
import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import styles from "@/components/brand-program/BrandProgramPage.module.css";
import {
  getAllPublicProgramGroups,
  getCarsystemProductsByPublicProgramSlug,
  refinishPhases,
} from "@/lib/carsystem-data";
import type { RefinishPhase } from "@/lib/carsystem-data";
import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  jsonLd,
  pageMetadata,
} from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Programi",
  description:
    "Pregled programskih celina za boje, pripremu, opremu, poliranje i potrošni materijal.",
  path: "/program",
});

export default function ProgramIndexPage() {
  const programs = getAllPublicProgramGroups();
  const phaseBySlug = new Map(refinishPhases.map((phase) => [phase.slug, phase]));

  return (
    <div className={styles.pageShell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          collectionPageJsonLd({
            name: "Programi",
            description:
              "Programske celine za boje, pripremu, opremu, poliranje i potrošni materijal.",
            path: "/program",
            itemUrls: programs.map((program) => `/program/${program.slug}`),
          }),
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Programi", path: "/program" },
          ]),
        )}
      />
      <main className={styles.main}>
        <SeoBreadcrumbs
          items={[
            { name: "Početna", path: "/" },
            { name: "Programi", path: "/program" },
          ]}
        />
        <section className={styles.indexIntro} aria-labelledby="programs-title">
          <div className={styles.indexIntroCopy}>
            <p className={styles.sectionKicker}>Programi</p>
            <h1 id="programs-title" className={styles.title}>
              Programi
            </h1>
            <p>
              Pet programskih celina pomažu da se katalog pregleda po fazi rada,
              tipu proizvoda i brendu.
            </p>
          </div>
          <div className={styles.indexIntroMeta} aria-label="Pregled programa">
            <span>{programs.length} programskih celina</span>
            <span>5 faza procesa</span>
            <span>Tehnički izbor</span>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="programs-grid-title">
          <div className={styles.sectionHeader}>
            <p className={styles.sectionKicker}>Proces</p>
            <h2 id="programs-grid-title">Programi po fazi rada</h2>
            <p>
              Svaki program otvara smernice, povezane brendove i proizvode za
              konkretan deo refinish procesa.
            </p>
          </div>
          <div className={styles.programCardGrid}>
            {programs.map((program) => {
              const productCount = getCarsystemProductsByPublicProgramSlug(program.slug).length;
              const phases = program.phaseSlugs
                .map((phaseSlug) => phaseBySlug.get(phaseSlug))
                .filter((phase): phase is RefinishPhase => Boolean(phase));

              return (
                <Link
                  className={`${styles.programCard} ${styles.programIndexCard}`}
                  href={`/program/${program.slug}`}
                  key={program.slug}
                >
                  <p className={styles.cardKicker}>{program.shortName}</p>
                  <h2>{program.name}</h2>
                  <p>{program.description}</p>
                  <div className={styles.programPhaseStrip}>
                    {phases.map((phase) => (
                      <span key={phase.slug}>{phase.name}</span>
                    ))}
                  </div>
                  <div className={styles.programPills}>
                    {program.badges.slice(0, 3).map((badge) => (
                      <span key={badge}>{badge}</span>
                    ))}
                    <span>{productCount} proizvoda</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
