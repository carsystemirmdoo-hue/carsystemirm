import type { Defect } from "@/lib/knowledge/entities";
import { unknownClaim } from "@/lib/knowledge/provenance";

/**
 * Refinish defect vocabulary.
 *
 * `description` is a visual observation — what the defect looks like on the
 * panel. That is safe to state.
 *
 * `causes`, `remedies` and `relatedProcessSteps` are diagnostic technical
 * claims and are left deliberately empty. Naming a cause for a paint defect
 * without a source is precisely the kind of plausible-sounding fabrication the
 * brief forbids: the same visible symptom has several possible causes, and
 * guessing wrong sends a workshop down an expensive rework path.
 *
 * These are populated only from an R-M technical document or a named Carsystem
 * expert. Until then the records exist so the structure and the review backlog
 * are real.
 */
export const defects: Defect[] = [
  {
    slug: "korozija",
    name: "Korozija",
    description: "Oksidacija metalne podloge, vidljiva kao mrlje ili naduvavanje sloja.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
  {
    slug: "slabo-prianjanje",
    name: "Slabo prianjanje",
    description: "Odvajanje nanetog sloja od podloge ili od prethodnog sloja.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
  {
    slug: "pomorandzina-kora",
    name: "Pomorandžina kora",
    description: "Neravna, talasasta tekstura završnog sloja nalik kori pomorandže.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
  {
    slug: "krateri",
    name: "Krateri",
    description: "Male kružne udubine u nanetom sloju.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
  {
    slug: "curenje-laka",
    name: "Curenje laka",
    description: "Slivanje materijala niz vertikalnu površinu tokom nanošenja.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
  {
    slug: "mehurici",
    name: "Mehurići",
    description: "Sitna izdignuća u sloju nastala zarobljenim vazduhom ili isparenjima.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
  {
    slug: "matiranje-sjaja",
    name: "Gubitak sjaja",
    description: "Smanjen sjaj završnog sloja u odnosu na očekivani izgled.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
  {
    slug: "razlika-u-nijansi",
    name: "Razlika u nijansi",
    description: "Vidljivo odstupanje nijanse popravljene površine od okolnog laka.",
    causes: unknownClaim<string[]>([], "Uzroke potvrđuje Carsystem tehnički tim."),
    remedies: unknownClaim<string[]>([], "Postupak sanacije zahteva stručnu potvrdu."),
    relatedProcessSteps: unknownClaim([]),
  },
];

export function getDefect(slug: string) {
  return defects.find((defect) => defect.slug === slug);
}
