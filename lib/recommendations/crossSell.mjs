/**
 * Predlozi dodatnih proizvoda — čista pravila (interno, samo za zaposlene).
 *
 * Dva izvora, uvek sa razlogom koji se može proveriti:
 *   peers   — firme koje kupuju ISTO što i ovaj kupac kupuju i artikal Y, a on
 *             ga ne kupuje. Samo broj firmi, nikad njihova imena.
 *   catalog — kataloški „kompatibilno sa" za proizvod koji kupac već kupuje,
 *             i to samo kada je predloženi proizvod POTVRĐENO vezan za artikal.
 *
 * Premalo podataka se kaže izričito; slab signal se prikazuje kao slab.
 */

/** Najmanje firmi sa istim artiklom za „jak" predlog. */
export const MIN_SUPPORT = 3;
/** Ispod ovoga predlog se ne prikazuje uopšte. */
export const WEAK_SUPPORT = 2;
/** Ispod ovoliko firmi sa potvrđenim kupovinama poređenje nema smisla. */
export const MIN_CUSTOMERS = 5;

/**
 * @param {string} customerId
 * @param {Map<string, Set<string>>} baskets  kupac → artikli (potvrđene kupovine u periodu)
 */
export function suggestFromPeers(customerId, baskets) {
  const mine = baskets.get(customerId) ?? new Set();
  if (mine.size === 0) return { peers: 0, suggestions: [] };
  const peers = [...baskets.entries()].filter(([id, set]) => id !== customerId && [...set].some((c) => mine.has(c)));
  const byCode = new Map();
  for (const [, set] of peers) {
    const shared = [...set].filter((c) => mine.has(c));
    for (const code of set) {
      if (mine.has(code)) continue;
      const e = byCode.get(code) ?? { articleCode: code, support: 0, because: new Map() };
      e.support += 1;
      for (const s of shared) e.because.set(s, (e.because.get(s) ?? 0) + 1);
      byCode.set(code, e);
    }
  }
  const suggestions = [...byCode.values()]
    .filter((e) => e.support >= WEAK_SUPPORT)
    .map((e) => ({
      articleCode: e.articleCode,
      support: e.support,
      peers: peers.length,
      strength: e.support >= MIN_SUPPORT ? "strong" : "weak",
      because: [...e.because.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c).slice(0, 3),
    }))
    .sort((a, b) => b.support - a.support || a.articleCode.localeCompare(b.articleCode));
  return { peers: peers.length, suggestions };
}

/**
 * @param {Set<string>} mine  artikli kupca
 * @param {{ code: string, slug: string }[]} myMapped  kupčevi artikli sa potvrđenom vezom
 * @param {(slug: string) => string[]} compatibleSlugs  kataloški „kompatibilno sa"
 * @param {Map<string, string[]>} codesBySlug  proizvod → potvrđeno vezani artikli
 */
export function suggestFromCatalog(mine, myMapped, compatibleSlugs, codesBySlug) {
  const out = new Map();
  for (const m of myMapped) {
    for (const slug of compatibleSlugs(m.slug)) {
      for (const code of codesBySlug.get(slug) ?? []) {
        if (mine.has(code) || out.has(code)) continue;
        out.set(code, { articleCode: code, viaCode: m.code, viaSlug: m.slug });
      }
    }
  }
  return [...out.values()];
}

/** Da li ima dovoljno podataka, i ako nema — zašto, rečima. */
export function dataSufficiency({ customersWithHistory, peers, myArticles }) {
  if (myArticles === 0) return { ok: false, reason: "Kupac nema potvrđenih kupovina u poslednjih godinu dana." };
  if (customersWithHistory < MIN_CUSTOMERS) {
    return { ok: false, reason: `Premalo firmi sa potvrđenim kupovinama (${customersWithHistory}; potrebno najmanje ${MIN_CUSTOMERS}) za poređenje.` };
  }
  if (peers < WEAK_SUPPORT) {
    return { ok: false, reason: `Premalo firmi sa sličnim kupovinama (${peers}) za pouzdano poređenje.` };
  }
  return { ok: true, reason: null };
}
