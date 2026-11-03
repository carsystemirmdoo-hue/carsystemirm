import { countCatalogCardsForProgramSlugs } from "@/lib/catalog-listing";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgramPage } from "@/components/program/ProgramPage";
import { SistemiProgramPage } from "@/components/sistemi/SistemiProgramPage";
import {
  getAllCarsystemBrands,
  getAllPublicProgramGroups,
  getBrandReferenceBySlug,
  getCarsystemProductsByPublicProgramSlug,
  getPublicProgramGroupBySlug,
  getRefinishPhaseBySlug,
  programGroups,
  refinishPhases,
  toProductListingProduct,
} from "@/lib/carsystem-data";
import type { BrandReference } from "@/lib/carsystem-data";
import type { RefinishPhase } from "@/lib/carsystem-data";
import { breadcrumbJsonLd, jsonLd, programJsonLd } from "@/lib/seo";
import { buildProgramMetadata } from "@/lib/seo/metadata-builders";
import { getSistemiContent } from "@/lib/sistemi/content";

type ProgramRouteProps = {
  params: Promise<{ slug: string }>;
};

// Veze ka vodičima se prikazuju samo za objavljene članke (baza), pa se strana obnavlja na 60 s.
export const revalidate = 60;

export function generateStaticParams() {
  return getAllPublicProgramGroups().map((program) => ({ slug: program.slug }));
}

export async function generateMetadata({
  params,
}: ProgramRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const program = getPublicProgramGroupBySlug(slug);
  if (!program) return {};

  return buildProgramMetadata(program);
}

export default async function ProgramRoute({ params }: ProgramRouteProps) {
  const { slug } = await params;
  const program = getPublicProgramGroupBySlug(slug);
  if (!program) notFound();

  /*
   * Brendovi i redosled proizvoda prate STVARNE proizvode programa. `program.brandSlugs` je spisak
   * glavnih brendova programa: oni idu prvi (tim redom), ostali po broju proizvoda. Tako „Pištolji
   * i oprema” počinje SATA pištoljima, a program ne navodi brend bez ijednog proizvoda.
   */
  const programProducts = getCarsystemProductsByPublicProgramSlug(program.slug);
  const productCount = new Map<string, number>();
  for (const product of programProducts) {
    productCount.set(product.brandSlug, (productCount.get(product.brandSlug) ?? 0) + 1);
  }
  const brandRank = (brandSlug: string) => {
    const listed = program.brandSlugs.indexOf(brandSlug);
    return listed >= 0 ? listed : program.brandSlugs.length;
  };
  const orderedBrandSlugs = [...productCount.keys()].sort(
    (first, second) =>
      brandRank(first) - brandRank(second) ||
      (productCount.get(second) ?? 0) - (productCount.get(first) ?? 0) ||
      first.localeCompare(second),
  );
  const brands = orderedBrandSlugs
    .map((brandSlug) => getBrandReferenceBySlug(brandSlug))
    .filter((brand): brand is BrandReference => Boolean(brand));
  const orderedProducts = [...programProducts].sort(
    (first, second) =>
      orderedBrandSlugs.indexOf(first.brandSlug) - orderedBrandSlugs.indexOf(second.brandSlug),
  );
  const content = getSistemiContent(program.slug);
  const phases = program.phaseSlugs
    .map((phaseSlug) => getRefinishPhaseBySlug(phaseSlug))
    .filter((phase): phase is RefinishPhase => Boolean(phase));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(
          breadcrumbJsonLd([
            { name: "Početna", path: "/" },
            { name: "Programi", path: "/program" },
            { name: program.name, path: `/program/${program.slug}` },
          ]),
        )}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd(programJsonLd(program))}
      />
      {content ? (
        <SistemiProgramPage
          brands={brands}
          catalogCardCount={countCatalogCardsForProgramSlugs(program.internalProgramSlugs)}
          content={content}
          program={program}
          programProducts={programProducts}
        />
      ) : (
        <ProgramPage
          brandBySlug={new Map(getAllCarsystemBrands().map((brand) => [brand.slug, brand]))}
          brands={brands}
          phaseBySlug={new Map(refinishPhases.map((phase) => [phase.slug, phase]))}
          phases={phases}
          products={orderedProducts.map(toProductListingProduct)}
          program={program}
          catalogCardCount={countCatalogCardsForProgramSlugs(program.internalProgramSlugs)}
          programBySlug={new Map(programGroups.map((item) => [item.slug, item]))}
        />
      )}
    </>
  );
}
