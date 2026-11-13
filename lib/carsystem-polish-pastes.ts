/**
 * Carsystem polir paste (odluka vlasnika 2026-11-13): svaka pasta ima svoju karticu, a sa jedne se lako
 * prelazi na ostale — svaka kartica nosi ostale paste kao povezane proizvode, ovim redom.
 */
export const CARSYSTEM_POLISH_PASTE_SLUGS = [
  "carsystem-polish-c-05-cut",
  "carsystem-polish-c-07-cut",
  "carsystem-polish-c-10-strong",
  "carsystem-polir-pasta-energetic-strong",
  "carsystem-polish-coarse-step-1",
  "carsystem-polish-fine-step-2",
  "carsystem-polish-c-30-finish",
  "carsystem-polir-pasta-superior-shine-finish",
  "carsystem-polish-finish-all-in-one-1-l",
  "carsystem-polish-x8000-ah",
] as const;

/** Ostale paste (bez ove), ispred dosadašnjih povezanih proizvoda kartice. */
export function withPolishPasteSiblings(slug: string, related: readonly string[] = []): string[] {
  if (!(CARSYSTEM_POLISH_PASTE_SLUGS as readonly string[]).includes(slug)) return [...related];
  return [...new Set([...CARSYSTEM_POLISH_PASTE_SLUGS.filter((s) => s !== slug), ...related])];
}
