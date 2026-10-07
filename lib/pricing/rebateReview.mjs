/**
 * Pregled rabata po kupcu iz potvrđenih faktura — čista pravila.
 *
 * Tri stvari se NIKAD ne mešaju:
 *   1. istorijski zabeležen rabat — šta piše na stavkama faktura (ovaj modul),
 *   2. predlog uslova — šta bi iz istorije moglo postati pravilo (predlog,
 *      ništa se ne upisuje),
 *   3. odobreno važeće pravilo — `price_rules`, čita se odvojeno.
 *
 * Grupe se ovde zaključuju iz štampanog naziva artikla (prefiks brenda) i zato
 * su uvek PREDLOG dok ne stigne šifarnik grupa iz BizniSofta. Istorijska cena
 * se ne koristi — samo procenat rabata na stavci.
 */

import { REBATE_CRITERIA } from "./rebateCriteria.mjs";

/* Pragovi žive u rebateCriteria.mjs; ovde su samo kraća imena. */
export const MIN_INVOICES = REBATE_CRITERIA.minInvoices;
export const STABLE_SHARE = REBATE_CRITERIA.stableShare;
export const HIGH_DISCOUNT = REBATE_CRITERIA.highDiscount;
export const RECENT_DAYS = REBATE_CRITERIA.recentDays;
export const CHANGE_RUN = REBATE_CRITERIA.changeRun;

const round = (d) => Math.round(Number(d) * 100) / 100;

export function normName(s) {
  return String(s ?? "")
    .toUpperCase()
    .replace(/Đ/g, "DJ")
    .replace(/[ČĆ]/g, "C")
    .replace(/Š/g, "S")
    .replace(/Ž/g, "Z")
    .replace(/\s+/g, " ")
    .trim();
}

/*
 * [obrazac nad normalizovanim nazivom, grupa, osnova]
 * „literal" = naziv počinje imenom brenda; „skracenica" = tumačenje prefiksa.
 * Redosled je bitan: prvo specifično.
 */
const BRAND_RULES = [
  [/^BASLAC/, "baslac", "literal"],
  [/^BEFAR\b/, "Befar", "literal"],
  [/^NORBIN\b/, "Norbin", "literal"],
  [/^RUPES\b/, "RUPES", "literal"],
  [/^SATA/, "SATA", "literal"],
  [/^SIA\b/, "sia", "literal"],
  [/^3M\b/, "3M", "literal"],
  [/^LEO\b/, "Befar", "skracenica"],
  [/^TURQUAZ\b/, "Befar", "skracenica"],
  [/^CS\b/, "Carsystem", "skracenica"],
  [/^CF\b/, "C.A.R.FIT", "skracenica"],
  [/^RM\b/, "R-M", "skracenica"],
  [/^COS[. ]/, "Cosmos Lac", "skracenica"],
  [/^SPRAY EASY ?MAX/, "Cosmos Lac", "skracenica"],
  [/AUTOFIT/, "A.U.T.O. Fit", "literal"],
  [/^AF\b/, "A.U.T.O. Fit", "skracenica"],
];
const OTHER_BRAND_WORDS = ["DAYSON", "BMA", "NASTROFLEX", "GERSON", "PRIMTEC", "TOPLINE"];

export const NO_GROUP = "Bez oznake brenda";

/**
 * Predložena grupa (brend) iz naziva artikla. Uvek predlog — `basis` kaže
 * zašto: „literal", „skracenica", „prva_rec" ili „nema".
 */
export function proposedGroup(articleName) {
  const n = normName(articleName);
  for (const [re, label, basis] of BRAND_RULES) if (re.test(n)) return { label, basis };
  const first = n.split(" ")[0] ?? "";
  if (OTHER_BRAND_WORDS.includes(first)) return { label: first, basis: "prva_rec" };
  return { label: NO_GROUP, basis: "nema" };
}

/** Vrednosti rabata po broju stavki i faktura, najčešća prva. */
function tally(lines) {
  const m = new Map();
  for (const l of lines) {
    const p = round(l.discountPercent);
    const v = m.get(p) ?? { percent: p, lines: 0, invoices: new Set(), firstOn: l.issuedOn, lastOn: l.issuedOn };
    v.lines += 1;
    v.invoices.add(l.invoiceId);
    if (l.issuedOn < v.firstOn) v.firstOn = l.issuedOn;
    if (l.issuedOn > v.lastOn) v.lastOn = l.issuedOn;
    m.set(p, v);
  }
  return [...m.values()]
    .map((v) => ({ ...v, invoices: v.invoices.size }))
    .sort((a, b) => b.lines - a.lines || b.invoices - a.invoices || b.percent - a.percent);
}

/** Fakture hronološki, svaka sa svojim najčešćim rabatom. */
export function invoiceTimeline(lines) {
  const m = new Map();
  for (const l of lines) {
    const inv = m.get(l.invoiceId) ?? { invoiceId: l.invoiceId, documentLabel: l.documentLabel, issuedOn: l.issuedOn, lines: [] };
    inv.lines.push(l);
    m.set(l.invoiceId, inv);
  }
  return [...m.values()]
    .map((inv) => {
      const values = tally(inv.lines);
      return {
        invoiceId: inv.invoiceId,
        documentLabel: inv.documentLabel,
        issuedOn: inv.issuedOn,
        percent: values[0].percent,
        mixed: values.length > 1,
        values: values.map((v) => ({ percent: v.percent, lines: v.lines })),
        lineCount: inv.lines.length,
      };
    })
    .sort((a, b) => a.issuedOn.localeCompare(b.issuedOn) || a.documentLabel.localeCompare(b.documentLabel));
}

function daysBetween(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/**
 * Promena rabata: poslednjih ≥ CHANGE_RUN faktura ima isti rabat, a pre toga
 * je ≥ CHANGE_RUN faktura u većini imalo drugi. Vraća `null` kada toga nema.
 */
export function detectChange(timeline) {
  if (timeline.length < CHANGE_RUN * 2) return null;
  const current = timeline[timeline.length - 1].percent;
  let start = timeline.length - 1;
  while (start > 0 && timeline[start - 1].percent === current) start -= 1;
  const run = timeline.length - start;
  const before = timeline.slice(0, start);
  if (run < CHANGE_RUN || before.length < CHANGE_RUN) return null;
  const prev = tally(before.map((t) => ({ discountPercent: t.percent, invoiceId: t.invoiceId, issuedOn: t.issuedOn })))[0];
  if (prev.percent === current || prev.invoices / before.length < 0.6) return null;
  const first = timeline[start];
  return {
    previousPercent: prev.percent,
    previousInvoices: prev.invoices,
    currentPercent: current,
    currentInvoices: run,
    since: first.issuedOn,
    sinceLabel: first.documentLabel,
    sinceInvoiceId: first.invoiceId,
    lastBefore: before[before.length - 1],
  };
}

/** Grupa je „ustaljena" kada jedan rabat drži ≥ STABLE_SHARE stavki i ima ≥ 3 stavke. */
function settled(group) {
  return group.lines >= 3 && group.share >= STABLE_SHARE;
}

/**
 * @typedef {{
 *   invoiceId: string, documentLabel: string, issuedOn: string,
 *   lineNumber?: number | null, articleCode: string, articleName?: string | null,
 *   discountPercent: number,
 * }} ReviewLine
 */

/**
 * Ceo pregled jednog kupca.
 * @param {ReviewLine[]} lines pozitivne prodajne stavke potvrđenih faktura
 */
export function reviewCustomer(lines) {
  if (lines.length === 0) {
    return { lineCount: 0, invoiceCount: 0, status: "bez_faktura", values: [], groups: [], exceptions: [], articleDifferences: [], timeline: [], change: null, last: null, mode: null };
  }
  const values = tally(lines);
  const timeline = invoiceTimeline(lines);
  const last = timeline[timeline.length - 1];
  const mode = { ...values[0], share: values[0].lines / lines.length };

  // Predložene grupe.
  const byGroup = new Map();
  for (const l of lines) {
    const g = proposedGroup(l.articleName);
    const e = byGroup.get(g.label) ?? { label: g.label, basis: g.basis, lines: [] };
    e.lines.push(l);
    byGroup.set(g.label, e);
  }
  const groups = [...byGroup.values()]
    .map((g) => {
      const v = tally(g.lines);
      const tl = invoiceTimeline(g.lines);
      const latest = tl[tl.length - 1];
      return {
        label: g.label,
        basis: g.basis,
        lines: g.lines.length,
        invoices: tl.length,
        percent: v[0].percent,
        share: v[0].lines / g.lines.length,
        values: v,
        last: { percent: latest.percent, issuedOn: latest.issuedOn, documentLabel: latest.documentLabel, invoiceId: latest.invoiceId },
        change: detectChange(tl),
      };
    })
    .sort((a, b) => b.lines - a.lines || a.label.localeCompare(b.label, "sr-Latn"));
  const groupOf = new Map(groups.map((g) => [g.label, g]));

  /*
   * Promena se traži UNUTAR predložene grupe. Na nivou cele fakture rabat
   * zavisi od toga koji brend je kupljen, pa bi faktura sa samo jednim brendom
   * izgledala kao „promena" iako se uslov nije menjao. Prijavljuje se promena
   * najveće grupe u kojoj je nađena.
   */
  const changed = groups.find((g) => g.change);
  const change = changed ? { ...changed.change, group: changed.label } : null;
  const lastGroups = [...new Set(lines.filter((l) => l.invoiceId === last.invoiceId).map((l) => proposedGroup(l.articleName).label))];

  // Izuzeci na nivou stavke.
  const exceptions = [];
  for (const l of lines) {
    const p = round(l.discountPercent);
    const g = groupOf.get(proposedGroup(l.articleName).label);
    const base = {
      percent: p,
      expected: g && settled(g) ? g.percent : null,
      group: g?.label ?? NO_GROUP,
      invoiceId: l.invoiceId,
      documentLabel: l.documentLabel,
      issuedOn: l.issuedOn,
      lineNumber: l.lineNumber ?? null,
      articleCode: l.articleCode,
      articleName: l.articleName ?? null,
    };
    if (p >= HIGH_DISCOUNT) exceptions.push({ kind: "visok_rabat", ...base });
    else if (base.expected !== null && p !== base.expected) {
      exceptions.push({ kind: p === 0 ? "bez_rabata" : "odstupa_od_grupe", ...base });
    }
  }
  exceptions.sort((a, b) => b.issuedOn.localeCompare(a.issuedOn) || a.articleCode.localeCompare(b.articleCode));

  // Artikli koji uporno imaju drugi rabat od svoje grupe.
  const byArticle = new Map();
  for (const l of lines) {
    const e = byArticle.get(l.articleCode) ?? { articleCode: l.articleCode, articleName: l.articleName ?? null, lines: [] };
    e.lines.push(l);
    byArticle.set(l.articleCode, e);
  }
  const articleDifferences = [];
  for (const a of byArticle.values()) {
    const g = groupOf.get(proposedGroup(a.articleName).label);
    if (!g || g.lines < 5 || g.share < 0.6) continue;
    const v = tally(a.lines);
    if (v.length !== 1 || v[0].percent === g.percent || v[0].invoices < 2) continue;
    articleDifferences.push({
      articleCode: a.articleCode,
      articleName: a.articleName,
      group: g.label,
      percent: v[0].percent,
      expected: g.percent,
      lines: v[0].lines,
      invoices: v[0].invoices,
      firstOn: v[0].firstOn,
      lastOn: v[0].lastOn,
      samples: invoiceTimeline(a.lines).slice(-3).map((t) => ({ invoiceId: t.invoiceId, documentLabel: t.documentLabel, issuedOn: t.issuedOn })),
    });
  }
  articleDifferences.sort((a, b) => b.lines - a.lines || a.articleCode.localeCompare(b.articleCode));

  const sizable = groups.filter((g) => g.lines >= 3);
  const groupConsistent =
    sizable.length > 1 &&
    sizable.reduce((s, g) => s + g.share * g.lines, 0) / sizable.reduce((s, g) => s + g.lines, 0) >= STABLE_SHARE &&
    new Set(sizable.map((g) => g.percent)).size > 1;

  let status;
  if (timeline.length < MIN_INVOICES) status = "premalo";
  else if (change && daysBetween(change.since, last.issuedOn) <= RECENT_DAYS) status = "nedavna_promena";
  else if (mode.share >= STABLE_SHARE) status = "stabilan";
  else if (groupConsistent) status = "razlike_po_grupi";
  else status = "nedosledan";

  return {
    lineCount: lines.length,
    invoiceCount: timeline.length,
    firstOn: timeline[0].issuedOn,
    lastOn: last.issuedOn,
    last: { ...last, groups: lastGroups },
    mode,
    values,
    status,
    change,
    groups,
    exceptions,
    articleDifferences,
    timeline,
  };
}

/** Kratak red za listu kupaca — isti izvor kao detalj, da se brojke ne razilaze. */
export function summarizeCustomer(lines) {
  const r = reviewCustomer(lines);
  const count = (kind) => r.exceptions.filter((e) => e.kind === kind).length;
  return {
    status: r.status,
    lineCount: r.lineCount,
    invoiceCount: r.invoiceCount,
    lastOn: r.lastOn ?? null,
    last: r.last ? { percent: r.last.percent, mixed: r.last.mixed, issuedOn: r.last.issuedOn, documentLabel: r.last.documentLabel, groups: r.last.groups } : null,
    mode: r.mode ? { percent: r.mode.percent, invoices: r.mode.invoices, share: r.mode.share } : null,
    change: r.change ? { previousPercent: r.change.previousPercent, currentPercent: r.change.currentPercent, since: r.change.since, group: r.change.group } : null,
    groupCount: r.groups.filter((g) => g.lines >= 3).length,
    exceptions: {
      high: count("visok_rabat"),
      noDiscount: count("bez_rabata"),
      deviation: count("odstupa_od_grupe"),
      articles: r.articleDifferences.length,
    },
  };
}

/**
 * Predlog uslova po predloženoj grupi — samo PRIKAZ. Nastaje isključivo iz
 * ustaljene grupe; ništa se ne upisuje i ne postaje pravilo bez odobrenja.
 * @param {ReturnType<typeof reviewCustomer>} review
 */
export function proposedTerms(review) {
  return review.groups
    .filter((g) => settled(g) && g.invoices >= 2 && g.percent < HIGH_DISCOUNT)
    .map((g) => ({
      group: g.label,
      basis: g.basis,
      percent: g.percent,
      lines: g.values[0].lines,
      invoices: g.values[0].invoices,
      share: g.share,
      changedRecently: Boolean(g.change && daysBetween(g.change.since, review.lastOn) <= RECENT_DAYS),
    }));
}

export const STATUS_LABELS = {
  stabilan: "Stabilan uslov",
  nedavna_promena: "Nedavna promena",
  razlike_po_grupi: "Različito po grupi",
  nedosledan: "Nedosledno",
  premalo: "Premalo faktura",
  bez_faktura: "Bez faktura",
};

export const EXCEPTION_LABELS = {
  visok_rabat: "Visok rabat — proveriti",
  bez_rabata: "Bez rabata, grupa ga inače ima",
  odstupa_od_grupe: "Drugi rabat od grupe",
};
