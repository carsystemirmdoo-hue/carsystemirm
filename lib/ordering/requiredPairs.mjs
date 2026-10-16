/**
 * Obavezan par u jednakoj količini (0056): blanko posuda → poklopac.
 *
 * Čisto pravilo, bez baze. Količine su u JM artikla (oba su KOM). Jedan poklopac može da zatvara
 * više posuda (stara i nova šifra iste posude): potreban broj poklopaca = ZBIR svih njegovih posuda.
 * Poklopac bez posude u korpi je takođe kršenje — ne prodaje se zasebno.
 */

/**
 * @param {{ articleId: string; companionId: string }[]} pairs aktivni parovi
 * @param {{ articleId: string; quantity: number }[]} lines stavke (korpa ili zahtev)
 * @returns {Map<string, number>} poklopac → potreban broj (samo poklopci koji se pominju u parovima)
 */
export function requiredCompanionQuantities(pairs, lines) {
  const qty = new Map();
  for (const l of lines) qty.set(l.articleId, (qty.get(l.articleId) ?? 0) + Number(l.quantity || 0));
  const need = new Map();
  for (const p of pairs) need.set(p.companionId, (need.get(p.companionId) ?? 0) + (qty.get(p.articleId) ?? 0));
  return need;
}

/** Da li je artikal poklopac nekog aktivnog para (ne menja se ručno). */
export function isRequiredCompanion(pairs, articleId) {
  return pairs.some((p) => p.companionId === articleId);
}

/**
 * Kršenja pravila nad stavkama.
 * @param {{ articleId: string; companionId: string }[]} pairs
 * @param {{ articleId: string; quantity: number }[]} lines
 * @returns {{ companionId: string; required: number; actual: number }[]}
 */
export function requiredPairProblems(pairs, lines) {
  const need = requiredCompanionQuantities(pairs, lines);
  const have = new Map();
  for (const l of lines) have.set(l.articleId, (have.get(l.articleId) ?? 0) + Number(l.quantity || 0));
  const out = [];
  for (const [companionId, required] of need) {
    const actual = have.get(companionId) ?? 0;
    if (Math.abs(actual - required) > 1e-9) out.push({ companionId, required, actual });
  }
  return out;
}

const n = (v) => String(Math.round(v * 1000) / 1000).replace(".", ",");

/** Poruka za kupca/kancelariju; `name` daje naziv artikla po ID-u. */
export function requiredPairMessage(problem, name) {
  const lid = name(problem.companionId);
  if (problem.required === 0) return `${lid}: poklopac se ne poručuje bez odgovarajuće posude.`;
  return `${lid}: broj poklopaca mora biti jednak broju posuda (${n(problem.required)}), a sada je ${n(problem.actual)}.`;
}
