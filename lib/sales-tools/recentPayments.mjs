/**
 * „Uplaćeno u poslednjih N dana“ (2026-11-24, zahtev vlasnika) — čista logika, bez baze.
 *
 * Portal nema izvod banke; uplata se vidi po tabeli dugovanja kancelarije: faktura koja je
 * nestala iz tabele je plaćena, a smanjen ostatak je delimična uplata. Poredi se snimak sa
 * početka perioda (`before`) sa poslednjim (`after`) — ne uzastopni snimci, da faktura koja
 * nestane pa se vrati ne bi bila brojana dva puta.
 *
 * Zaštita: ako u poslednjem snimku nema CELE tabele (komercijaliste) iz koje je faktura bila,
 * to nije uplata nego nepročitana tabela — takva faktura se ne broji.
 */

/** Ključ fakture: kupac + broj fakture; bez broja datum + iznos; bez oba — nema ključa. */
export function lineKey(l) {
  const inv = String(l.invoiceNumber ?? "").replace(/\s+/g, "").toUpperCase();
  if (inv) return `${l.customerId}|f:${inv}`;
  if (l.issuedOn && l.amount !== null && l.amount !== undefined) return `${l.customerId}|d:${l.issuedOn}|${Number(l.amount).toFixed(2)}`;
  return null;
}

/**
 * @typedef {{ customerId: string, sourceLabel: string | null, invoiceNumber: string | null, issuedOn: string | null, dueOn?: string | null, amount: number | null, remaining: number }} Line
 * @typedef {{ createdAt: string, lines: Line[] }} Snap
 * @param {{ before: Line[], after: Line[], between?: Snap[] }} input `between` = snimci posle `before`, hronološki (za datum uplate)
 * @returns {Map<string, { paidTotal: number, invoices: { invoiceNumber: string | null, issuedOn: string | null, before: number, after: number, paid: number, full: boolean, seenOn: string | null }[] }>}
 */
export function paymentsByCustomer({ before, after, between = [] }) {
  const afterBy = new Map();
  const afterLabels = new Set();
  for (const l of after) {
    if (l.sourceLabel) afterLabels.add(l.sourceLabel);
    const k = lineKey(l);
    if (k) afterBy.set(k, (afterBy.get(k) ?? 0) + l.remaining);
  }
  // Sabrano po ključu (ista faktura u dva reda tabele).
  const beforeBy = new Map();
  for (const l of before) {
    const k = lineKey(l);
    if (!k) continue;
    const cur = beforeBy.get(k);
    if (cur) cur.remaining += l.remaining;
    else beforeBy.set(k, { ...l, remaining: l.remaining });
  }
  const seenIndex = between.map((s) => {
    const m = new Map();
    for (const l of s.lines) {
      const k = lineKey(l);
      if (k) m.set(k, (m.get(k) ?? 0) + l.remaining);
    }
    return { createdAt: s.createdAt, m };
  });

  const out = new Map();
  for (const [k, b] of beforeBy) {
    if (b.sourceLabel && afterLabels.size && !afterLabels.has(b.sourceLabel)) continue;
    const a = afterBy.get(k) ?? 0;
    const paid = Math.round((b.remaining - a) * 100) / 100;
    if (paid < 0.5) continue;
    // Prvi snimak u kome je ostatak pao — približan dan uplate (dan kada je kancelarija upisala).
    let seenOn = null;
    for (const s of seenIndex) {
      if ((s.m.get(k) ?? 0) < b.remaining - 0.004) {
        seenOn = s.createdAt;
        break;
      }
    }
    const e = out.get(b.customerId) ?? { paidTotal: 0, invoices: [] };
    e.paidTotal = Math.round((e.paidTotal + paid) * 100) / 100;
    e.invoices.push({ invoiceNumber: b.invoiceNumber, issuedOn: b.issuedOn, before: b.remaining, after: a, paid, full: a < 0.5, seenOn });
    out.set(b.customerId, e);
  }
  for (const e of out.values()) e.invoices.sort((x, y) => String(y.seenOn ?? "").localeCompare(String(x.seenOn ?? "")) || y.paid - x.paid);
  return out;
}
