import type { TerminologyEntry } from "@/lib/knowledge/terminology";

/**
 * Serbian terminology map.
 *
 * Canonical terms are taken from existing project data — `seoCategoryLandings`
 * in `lib/seo/category-landings.ts` and `getRmCategorySingularName()` — so this
 * layer agrees with what the site already publishes.
 *
 * Every synonym is `needs-review`. The audit warned explicitly against assuming
 * the example pairs are universally interchangeable, and that caution is
 * justified: "punilo" and "prajmer" are one product to some painters and two to
 * others, and "farba" covers both basecoat and topcoat in casual use. Marking
 * these verified without an expert would embed a wrong equivalence into search
 * and, later, into answer matching.
 *
 * Statuses here are upgraded only by a named Carsystem expert.
 */
export const terminologyEntries: TerminologyEntry[] = [
  {
    slug: "bezbojni-lak",
    canonical: "bezbojni lak",
    gloss: "Završni prozirni sloj sistema laka.",
    rmCategorySlug: "clearcoat",
    terms: [
      { term: "klarlak", register: "workshop", status: "needs-review" },
      { term: "klar", register: "workshop", status: "needs-review" },
      { term: "prozirni lak", register: "common", status: "needs-review" },
      { term: "bezbojka", register: "workshop", status: "needs-review" },
      {
        term: "lak za auto",
        register: "common",
        status: "needs-review",
        reviewNote:
          "Kupci ovim izrazom često misle na ceo sistem boje, ne samo na bezbojni lak. Potvrditi opseg pre upotrebe u pretrazi.",
      },
    ],
  },
  {
    slug: "prajmer",
    canonical: "prajmer",
    gloss: "Temeljni materijal koji priprema podlogu za sistem boje.",
    rmCategorySlug: "primer-filler",
    terms: [
      { term: "temeljna boja", register: "common", status: "needs-review" },
      { term: "grund", register: "workshop", status: "needs-review" },
      { term: "primer", register: "loanword", status: "needs-review" },
      {
        term: "podloga",
        register: "common",
        status: "needs-review",
        reviewNote:
          "„Podloga“ u praksi označava i materijal i površinu na koju se nanosi. Dvosmisleno — potvrditi.",
      },
    ],
  },
  {
    slug: "punilac",
    canonical: "punilac",
    gloss: "Materijal za izravnavanje sitnih neravnina pre bojenja.",
    rmCategorySlug: "primer-filler",
    terms: [
      { term: "filer", register: "workshop", status: "needs-review" },
      { term: "punilo", register: "common", status: "needs-review" },
      {
        term: "prajmer",
        register: "workshop",
        status: "needs-review",
        reviewNote:
          "Neki majstori koriste isti izraz za prajmer i punilac. R-M program ih razlikuje. Stručno potvrditi da li se sme tretirati kao sinonim.",
      },
    ],
  },
  {
    slug: "bazna-boja",
    canonical: "bazna boja",
    gloss: "Sloj koji nosi nijansu unutar sistema boje.",
    rmCategorySlug: "basecoat",
    terms: [
      { term: "baza", register: "workshop", status: "needs-review" },
      { term: "bazni sloj", register: "formal", status: "needs-review" },
      { term: "basecoat", register: "loanword", status: "needs-review" },
      {
        term: "farba",
        register: "common",
        status: "needs-review",
        reviewNote:
          "Vrlo širok izraz u svakodnevnom govoru. Potvrditi da li se sme vezati za baznu boju u pretrazi.",
      },
    ],
  },
  {
    slug: "ucvrscivac",
    canonical: "učvršćivač",
    gloss: "Komponenta koja pokreće umrežavanje dvokomponentnog sistema.",
    rmCategorySlug: "hardener",
    terms: [
      { term: "hardener", register: "loanword", status: "needs-review" },
      { term: "katalizator", register: "workshop", status: "needs-review" },
      { term: "otvrđivač", register: "spelling-variant", status: "needs-review" },
    ],
  },
  {
    slug: "razredjivac",
    canonical: "razređivač",
    gloss: "Komponenta za podešavanje viskoziteta materijala.",
    rmCategorySlug: "thinner",
    terms: [
      { term: "tiner", register: "workshop", status: "needs-review" },
      { term: "razrjeđivač", register: "spelling-variant", status: "needs-review" },
      { term: "thinner", register: "loanword", status: "needs-review" },
    ],
  },
  {
    slug: "kit",
    canonical: "kit",
    gloss: "Poliesterska ispuna za izravnavanje većih neravnina.",
    rmCategorySlug: "bodyfiller",
    terms: [
      { term: "gitovanje", register: "workshop", status: "needs-review" },
      { term: "špahtlovanje", register: "workshop", status: "needs-review" },
      { term: "poliester kit", register: "common", status: "needs-review" },
      { term: "bodyfiller", register: "loanword", status: "needs-review" },
    ],
  },
  {
    slug: "sprej-u-boji",
    canonical: "sprej u boji",
    gloss: "Aerosolno pakovanje boje ili laka.",
    terms: [
      { term: "sprej", register: "common", status: "needs-review" },
      { term: "sprej boja", register: "common", status: "needs-review" },
      { term: "boja u spreju", register: "common", status: "needs-review" },
      { term: "aerosol", register: "formal", status: "needs-review" },
    ],
  },
  {
    slug: "celicni-lim",
    canonical: "čelični lim",
    gloss: "Čelična podloga karoserije.",
    terms: [
      { term: "lim", register: "common", status: "needs-review" },
      { term: "celicni lim", register: "spelling-variant", status: "needs-review" },
    ],
  },
  {
    slug: "plastika-branik",
    canonical: "plastika",
    gloss: "Polimerni delovi karoserije.",
    terms: [
      { term: "branik", register: "common", status: "needs-review" },
      { term: "plastični delovi", register: "common", status: "needs-review" },
      { term: "PP", register: "loanword", status: "needs-review" },
    ],
  },
];
