import Link from "next/link";
import { Footer } from "@/components/layout/Footer";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { companyContact } from "@/lib/company-contact";
import type { BrandReference, CarsystemProduct, PublicProgramGroup } from "@/lib/carsystem-data";
import { getFamilyForProduct } from "@/lib/product-families";
import { collectReferences, resolveSource } from "@/lib/sistemi/content";
import { sourceKey } from "@/lib/sistemi/keys";
import { getSistemiNavLinks, PAINT_SYSTEMS, SISTEMI_PAGE_COPY } from "@/lib/sistemi/pages";
import type { ResolvedSource, SistemiContent } from "@/lib/sistemi/types";
import { ProgramExplorer } from "./ProgramExplorer";
import { SourceList } from "./SistemiParts";
import { SistemiSubnav } from "./SistemiSubnav";
import styles from "./Sistemi.styles";

export function SistemiProgramPage({
  program,
  content,
  brands,
  programProducts,
  catalogCardCount,
}: {
  program: PublicProgramGroup;
  content: SistemiContent;
  brands: BrandReference[];
  programProducts: CarsystemProduct[];
  catalogCardCount: number;
}) {
  const copy = SISTEMI_PAGE_COPY[program.slug];
  const references = collectReferences(content);
  const href = `/program/${program.slug}`;

  return (
    <div className={styles.pageShell}>
      <main className={styles.main}>
        <SeoBreadcrumbs
          items={[
            { name: "Početna", path: "/" },
            { name: "Programi", path: "/program" },
            { name: program.name, path: href },
          ]}
        />
        <SistemiSubnav activeHref={href} links={getSistemiNavLinks()} />

        <header className={styles.hero}>
          <p className={styles.kicker}>Sistemi i programi</p>
          <h1 className={styles.title}>{program.name}</h1>
          {copy?.subtitle ? <p className={styles.subtitle}>{copy.subtitle}</p> : null}
          <p className={styles.lead}>{copy?.lead ?? program.description}</p>
          <div className={styles.actions}>
            <Link className={`${styles.primaryButton} cs-cta`} data-cta-fill="red" href="/prodavnice">
              <span>Pronađite najbližu prodavnicu</span>
            </Link>
            <Link className={`${styles.secondaryButton} cs-cta`} data-cta-on="theme" href={`/katalog?program=${program.slug}`}>
              <span>Proizvodi u katalogu ({catalogCardCount})</span>
            </Link>
          </div>
        </header>

        {program.slug === "boje-i-lakovi" ? <PaintSystemsSection products={programProducts} /> : null}

        <ProgramExplorer
          email={companyContact.email}
          emailHref={companyContact.emailHref}
          jobs={content.jobs}
          jobsTitle={copy?.jobsTitle ?? "Šta radite?"}
          materials={content.materials}
          materialsLead={copy?.materialsLead ?? ""}
          materialsTitle={copy?.materialsTitle ?? "Materijali"}
          problems={content.problems}
          programName={program.name}
          references={references}
          scales={content.scales}
        />

        {brands.length ? (
          <section aria-labelledby="brendovi-naslov" className={styles.section} id="brendovi">
            <div className={`${styles.band}`}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle} id="brendovi-naslov">
                  Brendovi u programu
                </h2>
                <p>
                  {brands.map((brand, index) => (
                    <span key={brand.slug}>
                      {index > 0 ? " · " : ""}
                      <Link className={styles.textLink} href={`/brendovi/${brand.slug}`}>
                        {brand.name}
                      </Link>
                    </span>
                  ))}
                </p>
              </div>
              <Link className={`${styles.secondaryButton} cs-cta`} data-cta-on="theme" href={`/katalog?program=${program.slug}`}>
                <span>Svi proizvodi programa</span>
              </Link>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
    </div>
  );
}

function PaintSystemsSection({ products }: { products: CarsystemProduct[] }) {
  const rows = PAINT_SYSTEMS.map((system) => {
    const count = products.filter((product) =>
      "familySlug" in system.match
        ? getFamilyForProduct(product)?.slug === system.match.familySlug
        : product.brandSlug === system.match.brandSlug && system.match.namePattern.test(product.name),
    ).length;
    const purposeSource = system.purpose ? resolveSource(system.purpose.source) : null;
    const documentSource = system.documentSource ? resolveSource({ doc: system.documentSource, strana: 1 }) : null;
    return { system, count, purposeSource, documentSource };
  }).filter((row) => row.count > 0);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="sistemi-naslov" className={styles.section} id="sistemi">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Ponuda</p>
        <h2 className={styles.sectionTitle} id="sistemi-naslov">
          Sistemi boja i lakova u katalogu
        </h2>
        <p className={styles.sectionLead}>
          Namena prema tehničkom listu proizvođača; detalje za rad daje list konkretnog proizvoda.
        </p>
      </div>
      <ul className={styles.systems}>
        {rows.map(({ system, count, purposeSource, documentSource }) => {
          const sources: Record<string, ResolvedSource> = {};
          if (system.purpose && purposeSource) sources[sourceKey(system.purpose.source)] = purposeSource;
          return (
            <li className={styles.system} key={`${system.brand}-${system.name}`}>
              <span className={styles.productBrand}>{system.brand}</span>
              <h3 className={styles.systemName}>{system.name}</h3>
              {system.purpose && purposeSource ? (
                <>
                  <p className={styles.systemPurpose}>{system.purpose.text}</p>
                  <SourceList refs={[system.purpose.source]} sources={sources} />
                </>
              ) : documentSource?.href ? (
                <p className={styles.systemPurpose}>
                  Namena i način rada:{" "}
                  <a className={styles.textLink} href={documentSource.href} rel="noopener noreferrer" target="_blank">
                    tehnički list
                  </a>
                  .
                </p>
              ) : null}
              <div className={styles.systemMeta}>
                <Link className={styles.textLink} href={system.href}>
                  {count === 1 ? "Proizvod u katalogu" : `${count} proizvoda u katalogu`}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
