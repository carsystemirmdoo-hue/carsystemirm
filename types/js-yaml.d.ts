/**
 * Minimalne deklaracije za `js-yaml` (koristi ga samo build rubrike
 * „Saveti i vodiči“, scripts/saveti/*). Paket je razvojna zavisnost bez
 * sopstvenih tipova; ovde je opisan samo deo API-ja koji se koristi.
 */
declare module "js-yaml" {
  export const JSON_SCHEMA: unknown;
  export function load(input: string, options?: { schema?: unknown; filename?: string }): unknown;
  export function dump(input: unknown, options?: Record<string, unknown>): string;
  const yaml: { load: typeof load; dump: typeof dump; JSON_SCHEMA: unknown };
  export default yaml;
}
