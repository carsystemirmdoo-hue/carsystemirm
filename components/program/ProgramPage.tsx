import { SupportBand } from "@/components/brand-program/SupportBand";
import { Footer } from "@/components/layout/Footer";
import { ProgramBrands } from "@/components/program/ProgramBrands";
import { ProgramHero } from "@/components/program/ProgramHero";
import { ProgramProducts } from "@/components/program/ProgramProducts";
import type {
  BrandReference,
  CarsystemBrand,
  CarsystemProduct,
  ProgramGroup,
  PublicProgramGroup,
  RefinishPhase,
} from "@/lib/carsystem-data";
import styles from "@/components/brand-program/BrandProgramPage.module.css";

export function ProgramPage({
  brandBySlug,
  brands,
  phaseBySlug,
  phases,
  products,
  program,
  programBySlug,
}: {
  brandBySlug: Map<string, CarsystemBrand>;
  brands: BrandReference[];
  phaseBySlug: Map<string, RefinishPhase>;
  phases: RefinishPhase[];
  products: CarsystemProduct[];
  program: PublicProgramGroup;
  programBySlug: Map<string, ProgramGroup>;
}) {
  return (
    <div className={styles.pageShell}>
      <main className={styles.main}>
        <ProgramHero phases={phases} productCount={products.length} program={program} />
        <ProgramProcessRail phases={Array.from(phaseBySlug.values())} program={program} />
        <ProgramGuidance program={program} />
        <ProgramBrands brands={brands} program={program} />
        <ProgramProducts
          brandBySlug={brandBySlug}
          phaseBySlug={phaseBySlug}
          products={products}
          programBySlug={programBySlug}
        />
        <SupportBand
          body="Katalog prikazuje proizvode po programu. Za izbor artikala, tehničku smernicu ili najbližu prodavnicu, pošaljite upit timu Carsystem i R-M."
          extraHref={`/katalog?program=${program.slug}`}
          extraLabel="Pogledaj katalog"
          primaryHref={`/kontakt?tema=proizvod&program=${program.slug}`}
          primaryLabel="Pošalji upit"
          title={`Pronađite proizvode za ${program.name}`}
        />
      </main>
      <Footer />
    </div>
  );
}

function ProgramProcessRail({
  phases,
  program,
}: {
  phases: RefinishPhase[];
  program: PublicProgramGroup;
}) {
  const activePhaseSlugs = new Set(program.phaseSlugs);
  const orderedPhases = [...phases].sort((a, b) => a.step - b.step);

  return (
    <section className={`${styles.section} ${styles.processSection}`} aria-labelledby="program-process-title">
      <div className={styles.sectionHeader}>
        <p className={styles.sectionKicker}>Refinish proces</p>
        <h2 id="program-process-title">Mesto programa u procesu rada</h2>
        <p>
          Program se čita kroz redosled pripreme, podloge, boje, laka i završne
          obrade. Aktivne faze su označene crvenim signalom.
        </p>
      </div>

      <ol className={styles.phaseRail}>
        {orderedPhases.map((phase) => {
          const isActive = activePhaseSlugs.has(phase.slug);

          return (
            <li
              className={`${styles.phaseRailItem} ${
                isActive ? styles.phaseRailItemActive : ""
              }`}
              key={phase.slug}
            >
              <span className={styles.phaseStep}>{phase.step.toString().padStart(2, "0")}</span>
              <strong>{phase.name}</strong>
              <p>{phase.description}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ProgramGuidance({ program }: { program: PublicProgramGroup }) {
  return (
    <section className={`${styles.section} ${styles.guidanceSection}`} aria-labelledby="program-guidance-title">
      <div className={styles.guidance}>
        <p className={styles.sectionKicker}>Tehnička smernica</p>
        <h2 id="program-guidance-title">{program.guidanceTitle}</h2>
        <p>{program.guidanceText}</p>
      </div>
    </section>
  );
}
