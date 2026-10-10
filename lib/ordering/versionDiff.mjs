/**
 * Razlika stavki između verzije zahteva i verzije koju zamenjuje (samo prikaz).
 *
 * Poredi po artiklu: dodato, uklonjeno, promenjena količina, promenjena cena
 * kupca po jedinici ili prelaz „na upit“ ↔ „sa cenom“. Ništa se ne računa
 * ponovo — porede se sačuvani snimci obe verzije.
 *
 * @typedef {{ articleId: string, articleCode: string, articleName: string, catalogName?: string | null, unit: string, quantity: number, netPrice: number | null, priceStatus: string }} DiffLine
 * @param {DiffLine[]} previous
 * @param {DiffLine[]} current
 */
export function versionDiff(previous, current) {
  const before = new Map(previous.map((l) => [l.articleId, l]));
  const now = new Set(current.map((l) => l.articleId));
  /** @type {Record<string, { added?: true, quantityFrom?: number, priceFrom?: number | null, statusFrom?: string }>} */
  const changed = {};
  for (const l of current) {
    const b = before.get(l.articleId);
    if (!b) {
      changed[l.articleId] = { added: true };
      continue;
    }
    const c = {};
    if (Number(b.quantity) !== Number(l.quantity)) c.quantityFrom = Number(b.quantity);
    if (b.priceStatus !== l.priceStatus) c.statusFrom = b.priceStatus;
    else if (l.priceStatus === "cena" && b.netPrice !== l.netPrice) c.priceFrom = b.netPrice;
    if (Object.keys(c).length) changed[l.articleId] = c;
  }
  const removed = previous.filter((l) => !now.has(l.articleId));
  return { changed, removed, count: Object.keys(changed).length + removed.length };
}
