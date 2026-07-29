import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProgramPage } from "@/components/program/ProgramPage";
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

type ProgramRouteProps = {
  params: Promise<{ slug: string }>;
};

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

  const brands = program.brandSlugs
    .map((brandSlug) => getBrandReferenceBySlug(brandSlug))
    .filter((brand): brand is BrandReference => Boolean(brand));
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
      <ProgramPage
        brandBySlug={new Map(getAllCarsystemBrands().map((brand) => [brand.slug, brand]))}
        brands={brands}
        phaseBySlug={new Map(refinishPhases.map((phase) => [phase.slug, phase]))}
        phases={phases}
        products={getCarsystemProductsByPublicProgramSlug(program.slug).map(
          toProductListingProduct,
        )}
        program={program}
        programBySlug={new Map(programGroups.map((item) => [item.slug, item]))}
      />
    </>
  );
}
