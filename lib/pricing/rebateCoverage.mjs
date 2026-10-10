/**
 * Pokrivenost rabata iz CELE istorije kupca (rabati-v2, 10.10.2026).
 *
 * Merenje na fakturama (12 meseci): na 88 % faktura jedan brend dobija jedan
 * rabat na celom računu; 82 % parova kupac–artikal sa ponovljenom kupovinom
 * ima uvek isti rabat; manji broj kupaca rabat pregovara po porudžbini.
 * Zato se par ne odbacuje samo zato što taj artikal nema tri kupovine, ako
 * drugi NEZAVISNI dokazi (drugi artikli iste porodice kod ISTOG kupca)
 * pouzdano potvrđuju uslov.
 *
 * Porodica: naziv daje samo KANDIDATA (brend, ili brend + linija). Porodica
 * važi za kupca tek kada njegove fakture to dokažu: ≥ 3 različita artikla,
 * ≥ 3 dana fakturisanja, ≥ 90 % stavki u skorašnjem prozoru sa istim rabatom,
 * i poslednje fakture bez promene uslova. Jednokratna odstupanja se ne
 * računaju u uslov, ali se prikazuju:
 *   - akcija na fakturi: više artikala porodice na JEDNOJ fakturi sa drugim
 *     rabatom (posebna porudžbina) — ne menja uslov porodice;
 *   - odstupanje artikla: samo taj artikal drugačije (moguć poseban uslov).
 * Prva reč naziva ili jedan opšti rabat kupca NIKAD sami nisu dokaz.
 *
 * Ishodi para (ništa se ne primenjuje samo):
 *   odobreno         — postoji odobreno pravilo (ne prepisuje se)
 *   ceka_odobrenje   — predlog već čeka odluku
 *   direktno         — poslednja 2 dana kupovine TOG artikla isti rabat, skorašnje
 *   izvedeno         — iz dokazane porodice kupca (artikal kupljen ređe/ranije)
 *   nejasno          — stvarna nedoumica, sa razlogom
 *   van_programa     — artikal nije u programu; istorija ostaje, ponuda ne
 */

export const COVERAGE_RULES = Object.freeze({
  version: "rabati-v2-2026-10-10",
  familyRecentDays: 180,
  familyFallbackDays: 365,
  familyMinArticles: 3,
  familyMinDays: 3,
  familyShare: 0.9,
  pairDirectMaxAgeDays: 365,
  derivedMaxPairAgeDays: 730,
});

/** Prefiksi koji su u šifarniku dosledna oznaka brenda (provereno na nazivima). */
const BRANDS = new Map([
  ["CS", "CS"], ["RM", "RM"], ["CF", "CF"], ["AF", "AF"], ["BEFAR", "BEFAR"], ["NORBIN", "NORBIN"],
  ["SIA", "SIA"], ["3M", "3M"], ["LEO", "LEO"], ["TURQUAZ", "TURQUAZ"], ["RUPES", "RUPES"], ["SATA", "SATA"],
]);

const eq = (a, b) => a !== null && b !== null && Math.abs(a - b) < 0.0005;
const DAY = 86400000;
const minus = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) - days * DAY).toISOString().slice(0, 10);
const ageDays = (from, to) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

/** Kandidati porodice iz naziva: [brend, brend+linija] ili samo [prve dve reči] za opšte nazive. */
export function familyCandidates(name) {
  const w = String(name ?? "").toUpperCase().trim().split(/\s+/).filter(Boolean);
  if (!w.length) return [];
  let brand = BRANDS.get(w[0]) ?? null;
  if (!brand && w[0].startsWith("BASLAC")) brand = "BASLAC";
  if (!brand && w[0].startsWith("COS.")) brand = "COSMOS";
  if (brand) {
    const rest = brand === "BASLAC" && w[0] !== "BASLAC" ? w[0].slice(6) : w[1];
    const series = rest ? (rest.match(/^(\d{2}-[A-Z]+)/)?.[1] ?? rest.replace(/[.,]+$/, "")) : null;
    return series ? [brand, `${brand} ${series}`] : [brand];
  }
  return w.length >= 2 ? [`${w[0]} ${w[1]}`] : [];
}

function dominant(values) {
  const c = new Map();
  for (const v of values) c.set(v, (c.get(v) ?? 0) + 1);
  const [value, n] = [...c].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] ?? [null, 0];
  return { value, n, total: values.length };
}

/**
 * Uslov porodice za jednog kupca.
 * @param {{ articleId: string, issuedOn: string, invoiceId: string, discountPercent: number }[]} lines — sve stavke porodice kupca
 * @param {Map<string, number[]>} approvedByArticle — odobreni procenti po artiklu (za proveru sukoba)
 */
export function familyCondition(key, lines, approvedByArticle, asOf, rules = COVERAGE_RULES) {
  const pick = (days) => lines.filter((l) => l.issuedOn >= minus(asOf, days) && l.issuedOn <= asOf);
  let win = pick(rules.familyRecentDays);
  if (new Set(win.map((l) => l.issuedOn)).size < rules.familyMinDays) win = pick(rules.familyFallbackDays);
  const dates = win.map((l) => l.issuedOn).sort();
  const base = { key, window: win.length ? [dates[0], dates.at(-1)] : null };
  if (!win.length) return { ...base, ok: false, reason: "nema kupovina porodice u poslednjih 12 meseci" };

  // Jednokratna odstupanja: rabat koji se javlja samo na JEDNOJ fakturi u prozoru.
  const daysByRate = new Map();
  for (const l of win) daysByRate.set(l.discountPercent, new Set([...(daysByRate.get(l.discountPercent) ?? []), l.invoiceId]));
  const first = dominant(win.map((l) => l.discountPercent));
  const actions = [];
  const oneOff = [];
  for (const [rate, invs] of daysByRate) {
    if (eq(rate, first.value) || invs.size !== 1) continue;
    const inv = [...invs][0];
    const at = win.filter((l) => l.invoiceId === inv && eq(l.discountPercent, rate));
    const others = win.filter((l) => l.invoiceId === inv && !eq(l.discountPercent, rate));
    if (new Set(at.map((l) => l.articleId)).size >= 2 && others.length === 0) actions.push({ invoiceId: inv, issuedOn: at[0].issuedOn, percent: rate, lines: at.length });
    else oneOff.push(...at.map((l) => ({ articleId: l.articleId, invoiceId: inv, issuedOn: l.issuedOn, percent: rate })));
  }
  // Akcije (cela faktura) se izuzimaju samo kada su retke; odstupanja jednog artikla se UVEK računaju u doslednost.
  const invoiceCount = new Set(win.map((l) => l.invoiceId)).size;
  const skip = actions.length <= Math.floor(invoiceCount / 4) ? new Set(actions.map((a) => a.invoiceId)) : new Set();
  if (!skip.size) actions.length = 0;
  const counted = win.filter((l) => !skip.has(l.invoiceId));
  const dom = dominant(counted.map((l) => l.discountPercent));
  const atMode = counted.filter((l) => eq(l.discountPercent, dom.value));
  const share = counted.length ? atMode.length / counted.length : 0;
  const articles = new Set(atMode.map((l) => l.articleId)).size;
  const days = new Set(atMode.map((l) => l.issuedOn)).size;
  const evidence = { ...base, percent: dom.value, share, articles, days, lines: counted.length, actions, oneOff };
  if (articles < rules.familyMinArticles) return { ...evidence, ok: false, reason: `isti rabat samo na ${articles} artikla porodice` };
  if (days < rules.familyMinDays) return { ...evidence, ok: false, reason: `isti rabat samo u ${days} dana kupovine` };
  if (share < rules.familyShare) return { ...evidence, ok: false, reason: `rabat porodice nije dosledan (${Math.round(share * 100)} % stavki sa ${dom.value} %)` };
  // Promena uslova u toku: poslednja dva dana kupovine porodice sa drugim (istim) rabatom.
  const lastDays = [...new Set(counted.map((l) => l.issuedOn))].sort().slice(-2);
  const lastRates = lastDays.map((d) => dominant(counted.filter((l) => l.issuedOn === d).map((l) => l.discountPercent)).value);
  if (lastRates.length === 2 && lastRates.every((r) => !eq(r, dom.value)) && eq(lastRates[0], lastRates[1])) {
    return { ...evidence, ok: false, reason: `moguća promena uslova: poslednje kupovine ${lastRates[0]} % umesto ${dom.value} %` };
  }
  // Odobrena pravila kupca u porodici moraju se slagati (izuzeci su dozvoljeni, većina ne sme biti protiv).
  const famArticles = new Set(lines.map((l) => l.articleId));
  const approved = [...famArticles].flatMap((a) => approvedByArticle.get(a) ?? []);
  const against = approved.filter((p) => !eq(p, dom.value)).length;
  if (approved.length >= 3 && against / approved.length > 1 - rules.familyShare) {
    return { ...evidence, ok: false, reason: `odobrena pravila porodice se ne slažu (${against} od ${approved.length} drugačije)` };
  }
  return { ...evidence, ok: true, reason: null };
}

/**
 * Klasifikacija svih parova jednog kupca.
 * @param {{
 *   lines: { articleId: string, articleName: string, invoiceId: string, issuedOn: string, discountPercent: number }[],
 *   rules: { articleId: string, discountPercent: number, approved: boolean }[],
 *   outOfProgramme: Set<string>,
 *   asOf: string,
 * }} input
 */
export function classifyCustomer({ lines, rules, outOfProgramme, asOf }, R = COVERAGE_RULES) {
  const sorted = [...lines].filter((l) => l.issuedOn <= asOf).sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || a.invoiceId.localeCompare(b.invoiceId));
  const byArticle = new Map();
  for (const l of sorted) (byArticle.get(l.articleId) ?? byArticle.set(l.articleId, []).get(l.articleId)).push(l);
  const approvedByArticle = new Map();
  const pendingByArticle = new Map();
  for (const r of rules) (r.approved ? approvedByArticle : pendingByArticle).set(r.articleId, [...((r.approved ? approvedByArticle : pendingByArticle).get(r.articleId) ?? []), Number(r.discountPercent)]);

  // Porodice: samo artikli u programu.
  const famLines = new Map();
  for (const l of sorted) {
    if (outOfProgramme.has(l.articleId)) continue;
    for (const k of familyCandidates(l.articleName)) (famLines.get(k) ?? famLines.set(k, []).get(k)).push(l);
  }
  const families = new Map();
  for (const [k, ls] of famLines) families.set(k, familyCondition(k, ls, approvedByArticle, asOf, R));
  // Porodica za par se računa BEZ tog artikla: dokaz mora doći od drugih artikala istog kupca.
  const familyFor = (name, articleId) => {
    const cands = familyCandidates(name);
    const cond = (k) => (k ? familyCondition(k, (famLines.get(k) ?? []).filter((l) => l.articleId !== articleId), approvedByArticle, asOf, R) : null);
    const specific = cands.length > 1 ? cond(cands[1]) : null;
    if (specific?.ok) return specific;
    const broad = cond(cands[0]);
    if (broad?.ok) return broad;
    // Razlog daje nivo koji ima drugih kupovina (linija bez drugih artikala ništa ne govori).
    return (specific?.window ? specific : broad) ?? specific ?? null;
  };

  const pairs = [];
  for (const [articleId, ls] of byArticle) {
    const name = ls.at(-1).articleName;
    const last = ls.at(-1);
    const base = { articleId, articleName: name, lastOn: last.issuedOn, purchases: new Set(ls.map((l) => l.invoiceId)).size, lastInvoices: lastInvoices(ls) };
    if (outOfProgramme.has(articleId)) { pairs.push({ ...base, outcome: "van_programa", percent: null, reason: "artikal nije u programu" }); continue; }
    const approved = approvedByArticle.get(articleId) ?? [];
    if (approved.length) {
      const distinct = [...new Set(approved)];
      if (distinct.length > 1) pairs.push({ ...base, outcome: "nejasno", percent: null, reason: `odobrena pravila u sukobu (${distinct.join(" / ")} %)` });
      else pairs.push({ ...base, outcome: "odobreno", percent: distinct[0], reason: null, differsRecent: !eq(last.discountPercent, distinct[0]) && ageDays(last.issuedOn, asOf) <= 45 });
      continue;
    }
    if ((pendingByArticle.get(articleId) ?? []).length) { pairs.push({ ...base, outcome: "ceka_odobrenje", percent: pendingByArticle.get(articleId)[0], reason: "predlog čeka odluku" }); continue; }

    const fam = familyFor(name, articleId);
    // Dani kupovine para: rabat po danu (mešovit dan = null).
    const days = [...new Set(ls.map((l) => l.issuedOn))].sort();
    const rateOn = (d) => { const r = [...new Set(ls.filter((l) => l.issuedOn === d).map((l) => l.discountPercent))]; return r.length === 1 ? r[0] : null; };
    const lastTwo = days.slice(-2).map(rateOn);
    const age = ageDays(last.issuedOn, asOf);
    const lastRate = rateOn(days.at(-1));
    // Da li je odstupanje para na poslednjoj fakturi bilo cela faktura (akcija)?
    const onAction = fam?.actions?.some((a) => a.invoiceId === last.invoiceId) ?? false;
    const famOk = fam?.ok ? fam : null;

    if (lastTwo.length === 2 && lastTwo[0] !== null && eq(lastTwo[0], lastTwo[1]) && age <= R.pairDirectMaxAgeDays && days.at(-2) >= minus(asOf, R.derivedMaxPairAgeDays)) {
      const r = lastTwo[0];
      const twoOnActions = famOk && !eq(r, famOk.percent) && days.slice(-2).every((d) => famOk.actions.some((a) => a.issuedOn === d));
      // Izuzetak važi samo ako je istovremen sa sadašnjim uslovom porodice; starije odstupanje je stari uslov.
      const beforeCondition = famOk && !eq(r, famOk.percent) && days.at(-1) < famOk.window[0];
      if (!twoOnActions && !beforeCondition) {
        pairs.push({ ...base, outcome: "direktno", percent: r, family: famOk?.key ?? null, exception: famOk ? !eq(r, famOk.percent) : false,
          reason: famOk && !eq(r, famOk.percent) ? `izuzetak u porodici „${famOk.key}“ (${famOk.percent} %): artikal dosledno ${r} %` : null });
        continue;
      }
    }
    if (famOk && age <= R.derivedMaxPairAgeDays) {
      const stale = last.issuedOn < (famOk.window?.[0] ?? asOf);
      if (lastRate !== null && (eq(lastRate, famOk.percent) || onAction || stale)) {
        pairs.push({ ...base, outcome: "izvedeno", percent: famOk.percent, family: famOk.key,
          reason: eq(lastRate, famOk.percent) ? null : onAction ? `poslednja kupovina na akciji (${lastRate} %); važi uslov porodice` : `kupljeno ${last.issuedOn} sa ${lastRate} %, pre sadašnjeg uslova porodice (${famOk.percent} % od ${famOk.window[0]})` });
        continue;
      }
      pairs.push({ ...base, outcome: "nejasno", percent: null, family: famOk.key, exception: true,
        reason: lastRate === null ? "poslednja faktura ima različite rabate za isti artikal" : `artikal ${lastRate} %, porodica „${famOk.key}“ ${famOk.percent} % — moguć poseban uslov` });
      continue;
    }
    pairs.push({ ...base, outcome: "nejasno", percent: null, family: fam?.key ?? null,
      reason: age > R.derivedMaxPairAgeDays ? `poslednja kupovina ${last.issuedOn} — starija od 2 godine`
        : fam ? fam.reason ?? "porodica nije dokazana" : "nema dokaza: jedna kupovina i bez porodice" });
  }
  return { families: [...families.values()], pairs };
}

function lastInvoices(ls) {
  const out = [];
  for (const l of [...ls].reverse()) {
    if (out.some((o) => o.invoiceId === l.invoiceId)) continue;
    out.push({ invoiceId: l.invoiceId, documentLabel: l.documentLabel ?? null, issuedOn: l.issuedOn, percent: l.discountPercent });
    if (out.length === 3) break;
  }
  return out;
}

/**
 * Podela na aktuelno / retko / istorijsko.
 *   aktuelni kupac: faktura u poslednjih `activeDays`;
 *   aktuelni artikal: u programu i (prodat bilo kome u `activeDays` ili na stanju poslednjeg lagera);
 *   par: aktuelno = oba aktuelna i kupljen u `activeDays`; retko = oba aktuelna, kupljen ranije;
 *        istorijsko = sve ostalo (neaktivan kupac, artikal van programa ili van prodaje).
 */
export function segmentPair({ customerLastOn, articleLastSoldOn, articleInStock, outOfProgramme, pairLastOn, asOf, activeDays = 365 }) {
  const from = minus(asOf, activeDays);
  const customerActive = customerLastOn >= from;
  const articleCurrent = !outOfProgramme && ((articleLastSoldOn ?? "") >= from || articleInStock === true);
  if (!customerActive || !articleCurrent) return "istorijsko";
  return pairLastOn >= from ? "aktuelno" : "retko";
}
