/**
 * Meta red kartice proizvoda („Brend · Program · Faza”). Kada program i faza imaju isti
 * naziv („Priprema · Priprema”, „Poliranje · Poliranje”), drugi se izostavlja — ponavljanje
 * je izgledalo kao greška u podacima i trošilo je prostor najvažnije oznake.
 */
export function cardMetaParts(parts: ReadonlyArray<string | null | undefined>): string[] {
  const out: string[] = [];
  for (const part of parts) {
    const value = part?.trim();
    if (!value) continue;
    if (out.some((existing) => existing.localeCompare(value, "sr-Latn", { sensitivity: "base" }) === 0)) continue;
    out.push(value);
  }
  return out;
}
