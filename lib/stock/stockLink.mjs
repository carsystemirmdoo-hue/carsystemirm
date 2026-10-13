/**
 * Veza reda lagera sa artiklom portala i potvrđenim pakovanjem (dok. 65).
 *
 * Šifra: `articles.code` je tekst sa vodećim nulama (faktura štampa 6 cifara), a
 * izvoz lagera u Excel-u ih gubi (šifra je broj). Ključ za vezu je šifra bez vodećih
 * nula — ali SAMO kada je jednoznačan: ako dva artikla portala daju isti ključ,
 * veza se ne pravi (sudar), nikad se ne bira „verovatniji".
 *
 * JM: izveštaj nema kolonu JM i JM se NE zaključuje iz naziva. Merodavna je samo
 * potvrđena prodajna jedinica (`article_pack_sizes`, 0047: JM + količina pakovanja,
 * potvrdio čovek). Bez nje nema broja pakovanja.
 */

/** Ključ za poređenje šifara: čisto numerička → bez vodećih nula; ostalo → velika slova. */
export function codeKey(code) {
  const s = String(code ?? "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s.replace(/^0+(?=\d)/, "");
  return s.toUpperCase();
}

/**
 * @param {Array<{ id: string, code: string }>} articles
 * @returns {Map<string, { articleId: string, code: string } | { collision: string[] }>}
 */
export function buildArticleIndex(articles) {
  const index = new Map();
  for (const a of articles) {
    const k = codeKey(a.code);
    if (k === null) continue;
    const prev = index.get(k);
    if (!prev) index.set(k, { articleId: a.id, code: a.code });
    else index.set(k, { collision: [...("collision" in prev ? prev.collision : [prev.code]), a.code] });
  }
  return index;
}

/**
 * Status veze jednog reda lagera.
 * @param {{ sourceCode: string, codeKey: string | null }} line
 * @param {ReturnType<typeof buildArticleIndex>} index
 * @param {Map<string, { unit: string, packQuantity: number, label: string, fractionalOk: boolean }>} packs po articleId
 * @returns {{ link: "povezan" | "nepovezan" | "sudar", articleId: string | null, articleCode: string | null,
 *            exactCode: boolean, unit: string | null, pack: { packQuantity: number, label: string, fractionalOk: boolean } | null,
 *            packStatus: "potvrdjeno" | "nema_potvrde" | "nije_primenljivo" }}
 */
export function linkLine(line, index, packs) {
  const hit = line.codeKey === null ? undefined : index.get(line.codeKey);
  if (!hit) return { link: "nepovezan", articleId: null, articleCode: null, exactCode: false, unit: null, pack: null, packStatus: "nije_primenljivo" };
  if ("collision" in hit) return { link: "sudar", articleId: null, articleCode: null, exactCode: false, unit: null, pack: null, packStatus: "nije_primenljivo" };
  const p = packs.get(hit.articleId) ?? null;
  const packOk = p && Number.isFinite(Number(p.packQuantity)) && Number(p.packQuantity) > 0 && String(p.unit ?? "").trim() !== "";
  return {
    link: "povezan",
    articleId: hit.articleId,
    articleCode: hit.code,
    exactCode: hit.code === line.sourceCode,
    unit: packOk ? String(p.unit).trim().toUpperCase() : null,
    pack: packOk ? { packQuantity: Number(p.packQuantity), label: p.label, fractionalOk: Boolean(p.fractionalOk) } : null,
    packStatus: packOk ? "potvrdjeno" : "nema_potvrde",
  };
}

/**
 * Broj CELIH pakovanja iz izvorne količine — samo uz potvrđenu vezu, JM i pakovanje.
 * Ovo je STANJE IZ IZVOZA, ne raspoloživost (formula raspoloživosti ne postoji).
 * @returns {{ status: "ok", packs: number } | { status: "nema_broja", reason: string }}
 */
export function wholePacks({ quantity, link }) {
  if (link.link !== "povezan") return { status: "nema_broja", reason: link.link === "sudar" ? "sudar_sifara" : "nepovezan" };
  if (link.packStatus !== "potvrdjeno" || !link.pack) return { status: "nema_broja", reason: "pakovanje_nepotvrdjeno" };
  if (quantity === null || quantity === undefined) return { status: "nema_broja", reason: "prazna_kolicina" };
  if (quantity < 0) return { status: "nema_broja", reason: "negativna_kolicina" };
  return { status: "ok", packs: Math.floor(quantity / link.pack.packQuantity + 1e-9) };
}
