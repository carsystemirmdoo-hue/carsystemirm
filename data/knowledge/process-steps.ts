import type { ProcessStep } from "@/lib/knowledge/entities";

/**
 * Canonical refinish sequence.
 *
 * The ordering itself is uncontroversial trade structure, not a technical
 * parameter — it is the same sequence already encoded in `refinishPhases` in
 * `lib/carsystem-data.ts`, expressed at finer granularity. Anything that *is* a
 * parameter (times, temperatures, grits) lives on product claims, not here.
 *
 * `refinishPhaseSlugs` maps each step back onto the existing product
 * `phaseSlug` values so products join the knowledge graph without a migration.
 */
export const processSteps: ProcessStep[] = [
  {
    slug: "procena-i-priprema",
    name: "Procena i priprema",
    order: 1,
    description:
      "Utvrđivanje stanja površine, čišćenje i odmašćivanje pre početka rada.",
    refinishPhaseSlugs: ["priprema"],
  },
  {
    slug: "brusenje",
    name: "Brušenje",
    order: 2,
    description: "Mehanička obrada površine abrazivima pre nanošenja materijala.",
    refinishPhaseSlugs: ["priprema"],
  },
  {
    slug: "kitovanje",
    name: "Kitovanje",
    order: 3,
    description: "Ispunjavanje neravnina poliesterskim ili srodnim ispunama.",
    refinishPhaseSlugs: ["priprema", "podloga"],
  },
  {
    slug: "temeljenje",
    name: "Temeljenje",
    order: 4,
    description: "Nanošenje prajmera i punioca koji formiraju podlogu za sistem boje.",
    refinishPhaseSlugs: ["podloga"],
  },
  {
    slug: "bojenje",
    name: "Bojenje",
    order: 5,
    description: "Nanošenje bazne boje i postizanje tražene nijanse.",
    refinishPhaseSlugs: ["boja"],
  },
  {
    slug: "lakiranje",
    name: "Lakiranje",
    order: 6,
    description: "Nanošenje bezbojnog laka kao završnog zaštitnog sloja.",
    refinishPhaseSlugs: ["lak"],
  },
  {
    slug: "susenje",
    name: "Sušenje",
    order: 7,
    description: "Kontrolisano sušenje nanetog sistema do stanja za dalju obradu.",
    refinishPhaseSlugs: ["lak"],
  },
  {
    slug: "poliranje",
    name: "Poliranje",
    order: 8,
    description: "Završna korekcija i uglačavanje lakirane površine.",
    refinishPhaseSlugs: ["poliranje"],
  },
];

export function getProcessStep(slug: string) {
  return processSteps.find((step) => step.slug === slug);
}

export function getProcessStepsForRefinishPhase(phaseSlug: string) {
  return processSteps.filter((step) => step.refinishPhaseSlugs.includes(phaseSlug));
}
