import type { AnswerIntent } from "@/lib/knowledge/answer-intents";
import { unknownClaim } from "@/lib/knowledge/provenance";

/**
 * Seed answer intents — the 20 questions identified in the SEO/AEO audit.
 *
 * Every `answer` is deliberately unpopulated.
 *
 * That is not an oversight, it is the point. Each of these questions has a
 * correct answer that depends on product technical data which currently exists
 * only inside manufacturer TDS PDFs that have not been extracted or reviewed.
 * Writing plausible answers here would produce exactly the failure mode the
 * brief forbids: fabricated refinishing guidance that reads as authoritative.
 *
 * What *is* populated is everything that can be derived honestly:
 *   - the real Serbian phrasings people use
 *   - the entity links (substrate, process step, defect) the answer will hang on
 *   - `missingData`, naming precisely what must be obtained
 *
 * Readiness is derived by `resolveAnswerIntentReadiness()`, never stored, so an
 * intent cannot be published while its answer is still unverified.
 */
export const answerIntents: AnswerIntent[] = [
  {
    slug: "prajmer-za-aluminijum",
    primaryBlocker: "technical-data",
    question: "Koji prajmer koristiti na aluminijumu?",
    questionVariants: [
      "prajmer za aluminijum",
      "čime se temelji aluminijum",
      "grund za aluminijum",
    ],
    topic: "substrate",
    answer: unknownClaim<string>(),
    substrateSlugs: ["aluminijum"],
    processStepSlugs: ["temeljenje"],
    priority: "high",
    missingData: [
      "Podaci o kompatibilnosti podloge (substrates) za R-M prajmere i punioce.",
      "Potvrda iz R-M tehničkih listova koji prajmeri su deklarisani za aluminijum.",
      "Stručna potvrda da li je potreban poseban wash/etch prajmer.",
    ],
  },
  {
    slug: "prajmer-za-plastiku",
    primaryBlocker: "technical-data",
    question: "Koji prajmer ide na plastiku, na primer na branik?",
    questionVariants: ["prajmer za branik", "kako se boji plastika", "prajmer za plastiku"],
    topic: "substrate",
    answer: unknownClaim<string>(),
    substrateSlugs: ["plastika"],
    processStepSlugs: ["temeljenje"],
    priority: "high",
    missingData: [
      "Podaci o kompatibilnosti podloge za R-M i Cosmos Lac prajmere za plastiku.",
      "Potvrda da li je potreban aditiv za elastičnost i u kom odnosu.",
    ],
  },
  {
    slug: "prajmer-za-pocinkovani-lim",
    primaryBlocker: "technical-data",
    question: "Koji prajmer na pocinkovani lim?",
    questionVariants: ["prajmer za pocinkovani lim", "grund za cinkovani lim"],
    topic: "substrate",
    answer: unknownClaim<string>(),
    substrateSlugs: ["pocinkovani-lim"],
    processStepSlugs: ["temeljenje"],
    priority: "high",
    missingData: [
      "Podaci o kompatibilnosti podloge za pocinkovane površine.",
      "Potvrda potrebne pripreme površine pre temeljenja.",
    ],
  },
  {
    slug: "priprema-povrsine-pre-lakiranja",
    primaryBlocker: "expert-validation",
    question: "Kako se priprema površina pre lakiranja?",
    questionVariants: ["priprema pre lakiranja", "kako pripremiti auto za farbanje"],
    topic: "process",
    answer: unknownClaim<string>(),
    processStepSlugs: ["procena-i-priprema", "brusenje", "kitovanje"],
    priority: "high",
    missingData: [
      "Stručno odobren tekst procesa pripreme za Carsystem vodič.",
    ],
  },
  {
    slug: "odnos-mesanja-bezbojnog-laka",
    requiredTechnicalFields: ["mixingRatio", "hardenerProductSlugs", "thinnerProductSlugs"],
    primaryBlocker: "technical-data",
    question: "Koji je odnos mešanja za bezbojni lak?",
    questionVariants: ["odnos mešanja klarlaka", "kako se meša bezbojni lak"],
    topic: "product-selection",
    answer: unknownClaim<string>(),
    processStepSlugs: ["lakiranje"],
    priority: "high",
    missingData: [
      "Odnos mešanja po proizvodu iz R-M tehničkih listova (mixingRatio).",
      "Pripadajući učvršćivač i razređivač po proizvodu.",
      "Napomena: odnos se razlikuje po proizvodu — jedinstven odgovor ne postoji.",
    ],
  },
  {
    slug: "razlika-2k-i-1k",
    primaryBlocker: "expert-validation",
    question: "Koja je razlika između 2K i 1K laka?",
    questionVariants: ["šta znači 2K lak", "1k ili 2k lak"],
    topic: "product-selection",
    answer: unknownClaim<string>(),
    processStepSlugs: ["lakiranje"],
    priority: "medium",
    missingData: [
      "Stručno odobreno objašnjenje razlike u kontekstu R-M i Cosmos Lac programa.",
    ],
  },
  {
    slug: "sta-je-vodena-baza",
    primaryBlocker: "expert-validation",
    question: "Šta je vodena baza (waterborne)?",
    questionVariants: ["waterborne boja", "vodena baza za auto"],
    topic: "system",
    answer: unknownClaim<string>(),
    processStepSlugs: ["bojenje"],
    priority: "medium",
    missingData: [
      "Stručno odobreno objašnjenje waterborne tehnologije.",
    ],
  },
  {
    slug: "koliko-slojeva-bezbojnog-laka",
    requiredTechnicalFields: ["coats", "filmThicknessMicrons"],
    primaryBlocker: "technical-data",
    question: "Koliko slojeva bezbojnog laka treba naneti?",
    questionVariants: ["broj slojeva klarlaka", "koliko puta se lakira"],
    topic: "process",
    answer: unknownClaim<string>(),
    processStepSlugs: ["lakiranje"],
    priority: "high",
    missingData: [
      "Broj slojeva i debljina sloja po proizvodu iz R-M tehničkih listova.",
    ],
  },
  {
    slug: "pomorandzina-kora-uzrok",
    primaryBlocker: "expert-validation",
    question: "Zašto nastaje pomorandžina kora?",
    questionVariants: ["orange peel lak", "zašto je lak talasast"],
    topic: "defect",
    answer: unknownClaim<string>(),
    defectSlugs: ["pomorandzina-kora"],
    processStepSlugs: ["lakiranje"],
    priority: "medium",
    missingData: [
      "Uzroci defekta iz R-M dokumentacije ili od Carsystem stručnjaka.",
      "Postupak sanacije i prevencije.",
    ],
  },
  {
    slug: "krateri-u-laku",
    primaryBlocker: "expert-validation",
    question: "Kako ukloniti kratere u laku?",
    questionVariants: ["krateri u laku", "rupice u laku posle farbanja"],
    topic: "defect",
    answer: unknownClaim<string>(),
    defectSlugs: ["krateri"],
    processStepSlugs: ["lakiranje"],
    priority: "medium",
    missingData: [
      "Uzroci i postupak sanacije kratera, stručno potvrđeni.",
    ],
  },
  {
    slug: "lak-za-felne",
    primaryBlocker: "technical-data",
    question: "Koji lak koristiti za felne?",
    questionVariants: ["boja za felne", "sprej za felne"],
    topic: "product-selection",
    answer: unknownClaim<string>(),
    processStepSlugs: ["bojenje", "lakiranje"],
    priority: "medium",
    missingData: [
      "Potvrda koje Cosmos Lac Wheel Rim varijante su preporučene i za koje podloge.",
    ],
  },
  {
    slug: "boja-otporna-na-visoke-temperature",
    primaryBlocker: "technical-data",
    question: "Koja boja je otporna na visoke temperature?",
    questionVariants: ["boja za auspuh", "sprej otporan na toplotu"],
    topic: "product-selection",
    answer: unknownClaim<string>(),
    priority: "medium",
    missingData: [
      "Temperaturni opseg po proizvodu iz Cosmos Lac dokumentacije.",
      "Potvrda podloga na kojima se sme koristiti.",
    ],
  },
  {
    slug: "kit-za-rupe-na-limu",
    primaryBlocker: "technical-data",
    question: "Koji kit koristiti za rupe na limu?",
    questionVariants: ["kit za lim", "poliester kit za auto", "čime se gituje lim"],
    topic: "product-selection",
    answer: unknownClaim<string>(),
    substrateSlugs: ["celik"],
    processStepSlugs: ["kitovanje"],
    priority: "medium",
    missingData: [
      "Podaci o podlogama i ograničenjima za kitove u ponudi.",
    ],
  },
  {
    slug: "kako-se-bira-nijansa",
    primaryBlocker: "expert-validation",
    question: "Kako se bira nijansa ili RAL boja?",
    questionVariants: ["kako naći nijansu auta", "RAL karta boja", "kod boje na autu"],
    topic: "process",
    answer: unknownClaim<string>(),
    processStepSlugs: ["bojenje"],
    priority: "high",
    missingData: [
      "Stručno odobren opis postupka utvrđivanja nijanse.",
      "Potvrda kako se koristi Cosmos Lac RAL karta u odnosu na fizički uzorak.",
    ],
  },
  {
    slug: "razlika-agilis-onyx",
    primaryBlocker: "expert-validation",
    question: "Šta je AGILIS, a šta ONYX HD?",
    questionVariants: ["R-M AGILIS sistem", "razlika agilis onyx"],
    topic: "system",
    answer: unknownClaim<string>(),
    processStepSlugs: ["bojenje"],
    priority: "medium",
    missingData: [
      "Stručno odobren opis R-M sistema i njihove namene.",
    ],
  },
  {
    slug: "koliko-se-susi-lak",
    requiredTechnicalFields: ["dryingProfile"],
    primaryBlocker: "technical-data",
    question: "Koliko se suši lak i na kojoj temperaturi?",
    questionVariants: ["vreme sušenja laka", "na koliko stepeni se suši lak"],
    topic: "process",
    answer: unknownClaim<string>(),
    processStepSlugs: ["susenje"],
    priority: "high",
    missingData: [
      "Profil sušenja po proizvodu iz R-M tehničkih listova (dryingProfile).",
    ],
  },
  {
    slug: "koji-razredjivac-za-koji-lak",
    requiredTechnicalFields: ["thinnerProductSlugs"],
    primaryBlocker: "technical-data",
    question: "Koji razređivač ide uz koji lak?",
    questionVariants: ["koji tiner za lak", "razređivač za bezbojni lak"],
    topic: "product-selection",
    answer: unknownClaim<string>(),
    processStepSlugs: ["lakiranje"],
    priority: "high",
    missingData: [
      "Veza proizvod → razređivač iz R-M tehničkih listova (thinnerProductSlugs).",
      "Postoji potvrđena kompatibilnost samo za mali broj proizvoda u postojećim podacima.",
    ],
  },
  {
    slug: "koja-dizna-za-bezbojni-lak",
    requiredTechnicalFields: ["sprayGun"],
    primaryBlocker: "technical-data",
    question: "Koja dizna na pištolju se koristi za bezbojni lak?",
    questionVariants: ["dizna za klarlak", "koji pištolj za lak"],
    topic: "process",
    answer: unknownClaim<string>(),
    processStepSlugs: ["lakiranje"],
    priority: "medium",
    missingData: [
      "Preporučeni prečnik dizne i pritisak po proizvodu iz R-M tehničkih listova.",
    ],
  },
  {
    slug: "gde-kupiti-auto-lakove",
    primaryBlocker: "expert-validation",
    question: "Gde kupiti auto lakove u Srbiji?",
    questionVariants: ["prodavnica auto lakova", "gde se kupuje auto boja"],
    topic: "commercial",
    answer: unknownClaim<string>(),
    priority: "high",
    missingData: [
      "Samo stručno/vlasničko odobrenje formulacije. Podaci o mreži već postoje i verifikovani su u data/store-locations.json.",
    ],
  },
  {
    slug: "sta-treba-za-lakiranje-jednog-dela",
    requiredTechnicalFields: ["mixingRatio", "coats", "dryingProfile"],
    primaryBlocker: "technical-data",
    question: "Šta je sve potrebno za lakiranje jednog dela?",
    questionVariants: ["šta treba za farbanje branika", "materijal za lakiranje vrata"],
    topic: "process",
    answer: unknownClaim<string>(),
    processStepSlugs: [
      "procena-i-priprema",
      "brusenje",
      "temeljenje",
      "bojenje",
      "lakiranje",
    ],
    priority: "high",
    missingData: [
      "Kompletna lista sistemskih komponenti po fazi, stručno potvrđena.",
      "Izdašnost po proizvodu radi procene količine.",
    ],
  },
];
