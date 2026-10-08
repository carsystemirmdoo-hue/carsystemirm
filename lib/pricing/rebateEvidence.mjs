/**
 * Rabati po grupama iz prethodnih faktura (računa-otpremnica) — čista pravila.
 *
 * Ovo je PRIPREMA, ne cenovnik. Rezultat je predlog sa dokazima: koje
 * fakture, koji datumi, koji rabat. Istorijska cena se ovde ne koristi uopšte
 * — gleda se samo procenat rabata na stavci, jer se cena menja, a ugovoreni
 * rabat po grupi je ono što se ponavlja.
 *
 * Razvrstavanje po paru (kupac, grupa artikla):
 *   consistent     — isti rabat na dovoljno stavki i dokumenata → kandidat za predlog
 *   contradictory  — različiti rabati za istu grupu → čovek odlučuje
 *   thin           — premalo stavki ili dokumenata (ima prednost: nije dokaz ni u jednom smeru)
 *   no_discount    — dovoljno stavki, sve bez rabata → dokaz da uslova nema
 *   missing_group  — artikal bez grupe; rabat po grupi se ne može izvesti
 */

export const MIN_LINES = 3;
export const MIN_DOCUMENTS = 2;
/** Razlika manja od ovoga je zaokruživanje, ne drugi rabat. */
export const DISCOUNT_TOLERANCE = 0.001;

function norm(d) {
  return Math.round(Number(d) * 1000) / 1000;
}

/**
 * @param {{
 *   customerId: string, customerName: string, productGroup: string | null,
 *   articleCode: string, invoiceId: string, documentLabel: string, issuedOn: string,
 *   discountPercent: number,
 * }[]} lines
 */
export function analyzeRebates(lines, { minLines = MIN_LINES, minDocuments = MIN_DOCUMENTS } = {}) {
  const groups = new Map();
  for (const l of lines) {
    const key = `${l.customerId}|${l.productGroup ?? ""}`;
    let g = groups.get(key);
    if (!g) {
      g = { customerId: l.customerId, customerName: l.customerName, productGroup: l.productGroup ?? null, lines: [] };
      groups.set(key, g);
    }
    g.lines.push(l);
  }

  return [...groups.values()]
    .map((g) => {
      const values = new Map();
      const documents = new Set();
      const articles = new Set();
      for (const l of g.lines) {
        const d = norm(l.discountPercent);
        /** @type {{ discountPercent: number, lines: number, documents: Set<string>, articles: Set<string>, samples: { invoiceId: string, documentLabel: string, issuedOn: string, articleCode: string }[] }} */
        const v = values.get(d) ?? { discountPercent: d, lines: 0, documents: new Set(), articles: new Set(), samples: [] };
        v.lines += 1;
        v.documents.add(l.invoiceId);
        v.articles.add(l.articleCode);
        if (v.samples.length < 4 && !v.samples.some((s) => s.invoiceId === l.invoiceId)) {
          v.samples.push({ invoiceId: l.invoiceId, documentLabel: l.documentLabel, issuedOn: l.issuedOn, articleCode: l.articleCode });
        }
        values.set(d, v);
        documents.add(l.invoiceId);
        articles.add(l.articleCode);
      }
      const dates = g.lines.map((l) => l.issuedOn).sort();
      const distinct = [...values.values()]
        .map((v) => ({ ...v, documents: v.documents.size, articles: [...v.articles].sort() }))
        .sort((a, b) => b.lines - a.lines || a.discountPercent - b.discountPercent);

      let status;
      if (!g.productGroup) status = "missing_group";
      else if (distinct.length > 1) status = "contradictory";
      // Premalo stavki nije dokaz ni za rabat ni za njegovo odsustvo.
      else if (g.lines.length < minLines || documents.size < minDocuments) status = "thin";
      else if (distinct[0].discountPercent === 0) status = "no_discount";
      else status = "consistent";

      return {
        customerId: g.customerId,
        customerName: g.customerName,
        productGroup: g.productGroup,
        status,
        candidatePercent: status === "consistent" ? distinct[0].discountPercent : null,
        lineCount: g.lines.length,
        documentCount: documents.size,
        articleCodes: [...articles].sort(),
        firstOn: dates[0],
        lastOn: dates[dates.length - 1],
        values: distinct,
      };
    })
    .sort(
      (a, b) =>
        a.customerName.localeCompare(b.customerName, "sr-Latn") ||
        String(a.productGroup ?? "~").localeCompare(String(b.productGroup ?? "~"), "sr-Latn"),
    );
}

/**
 * Poređenje kandidata sa uslovom koji već postoji (pravilo u portalu ili
 * cenovnik). Vraća opis razlike ili `null` kada se slažu ili uslova nema.
 */
export function conflictWithExisting(candidatePercent, existing) {
  if (candidatePercent === null || candidatePercent === undefined) return null;
  const found = (existing ?? []).filter((e) => Math.abs(Number(e.discountPercent) - candidatePercent) > DISCOUNT_TOLERANCE);
  if (found.length === 0) return null;
  return found.map((e) => `${e.source}: ${Number(e.discountPercent)} %`).join("; ");
}

/** Obrazloženje koje ide u predlog pravila — dokaz, ne procena. */
export function proposalReason(item) {
  const v = item.values[0];
  const docs = v.samples.map((s) => `${s.documentLabel} (${s.issuedOn})`).join(", ");
  return (
    `Iz faktura: rabat ${item.candidatePercent} % na ${item.lineCount} stavki u ${item.documentCount} dokumenata ` +
    `(${item.firstOn} – ${item.lastOn}), artikli ${item.articleCodes.join(", ")}. Primeri: ${docs}. ` +
    "Predlog iz istorije — važi tek posle odobrenja i unosa u BizniSoft."
  ).slice(0, 1000);
}
