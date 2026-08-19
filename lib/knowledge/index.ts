/**
 * Carsystem knowledge layer — public entry point.
 *
 * Import from `@/lib/knowledge` rather than reaching into individual modules,
 * so the internal file layout can change without touching consumers.
 *
 * Layer boundaries:
 *   - `lib/carsystem-data.ts`  catalogue facts (products, brands, programs)
 *   - `lib/knowledge/*`        domain knowledge + provenance + review state
 *   - `lib/seo/*`              how any of it is presented to crawlers
 *
 * The knowledge layer may read the catalogue. The catalogue must never read the
 * knowledge layer.
 */

export * from "./provenance";
export * from "./entities";
export * from "./technical";
export * from "./terminology";
export * from "./answer-intents";
export * from "./guides";
export * from "./product-knowledge";

export { substrates, getSubstrate } from "@/data/knowledge/substrates";
export {
  processSteps,
  getProcessStep,
  getProcessStepsForRefinishPhase,
} from "@/data/knowledge/process-steps";
export { defects, getDefect } from "@/data/knowledge/defects";
export { terminologyEntries } from "@/data/knowledge/terminology";
export { answerIntents } from "@/data/knowledge/answer-intents";
export { guides } from "@/data/knowledge/guides";
