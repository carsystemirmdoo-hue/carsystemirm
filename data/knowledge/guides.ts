import type { Guide } from "@/lib/knowledge/guides";
import { unknownClaim } from "@/lib/knowledge/provenance";

/**
 * Guide records.
 *
 * All three seeds are `draft` with empty, unverified bodies, so
 * `isGuidePublishable()` withholds every one of them: no route is generated, no
 * sitemap entry is emitted and no schema is produced. `/vodici` renders a
 * neutral "in preparation" page rather than a list of empty links.
 *
 * These exist to (a) reserve the slugs, (b) record which guides the answer
 * intents are waiting on, and (c) prove the publication gate actually withholds
 * unfinished content — verified by `scripts/validate-knowledge.mjs` and by
 * inspecting the built HTML.
 *
 * Bodies are written by a Carsystem technical expert. Not generated.
 */
export const guides: Guide[] = [
  {
    slug: "priprema-povrsine-pre-lakiranja",
    title: "Priprema površine pre lakiranja",
    summary:
      "Redosled pripreme površine u profesionalnom refinish procesu, od procene do temeljenja.",
    status: "draft",
    primaryIntentSlug: "priprema-povrsine-pre-lakiranja",
    body: unknownClaim([], "Tekst piše i odobrava Carsystem tehnički tim."),
    processStepSlugs: ["procena-i-priprema", "brusenje", "kitovanje", "temeljenje"],
    relatedIntentSlugs: ["prajmer-za-aluminijum", "prajmer-za-plastiku", "kit-za-rupe-na-limu"],
  },
  {
    slug: "izbor-prajmera-po-podlozi",
    title: "Izbor prajmera prema podlozi",
    summary:
      "Kako se temeljni materijal bira prema materijalu podloge u refinish procesu.",
    status: "draft",
    body: unknownClaim([], "Zahteva popunjene substrates podatke i stručnu potvrdu."),
    substrateSlugs: ["celik", "pocinkovani-lim", "aluminijum", "plastika"],
    processStepSlugs: ["temeljenje"],
    relatedIntentSlugs: [
      "prajmer-za-aluminijum",
      "prajmer-za-plastiku",
      "prajmer-za-pocinkovani-lim",
    ],
  },
  {
    slug: "utvrdjivanje-nijanse",
    title: "Utvrđivanje nijanse i rad sa RAL kartom",
    summary:
      "Postupak utvrđivanja nijanse vozila i odnos ekranskog prikaza prema fizičkom uzorku.",
    status: "draft",
    primaryIntentSlug: "kako-se-bira-nijansa",
    body: unknownClaim([], "Tekst piše i odobrava Carsystem tehnički tim."),
    processStepSlugs: ["bojenje"],
    relatedIntentSlugs: ["kako-se-bira-nijansa"],
  },
];
