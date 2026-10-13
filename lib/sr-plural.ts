/**
 * Srpska množina uz broj: 1, 21, 31 … → `one`; 2–4, 22–24 … → `few`; ostalo → `many`.
 * (11–14 su uvek `many`.) Primer: 1 varijanta, 3 varijante, 5 varijanti, 21 varijanta.
 */
export function srPlural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100;
  const last = n % 10;
  if (n >= 11 && n <= 14) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
}

export function variantCountLabel(count: number): string {
  return `${count} ${srPlural(count, "varijanta", "varijante", "varijanti")}`;
}
