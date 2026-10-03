import { classifyPib } from "./pib.mjs";

/**
 * Registar BizniSoft partnera — čista logika, bez baze i bez mreže.
 *
 * Šta registar JESTE: snimak matičnih podataka partnera onako kako ih izvoz
 * navodi (šifra, naziv, PIB, mesto, adresa, e-mail, šifra komercijaliste).
 *
 * Šta registar NIJE: spisak kupaca. Popunjena šifra komercijaliste je radni
 * kriterijum da je partner KANDIDAT za kupca, ne dokaz da je išta kupio. Kupac
 * se potvrđuje prodajnim dokumentom, a ne karticom partnera.
 *
 * Tri pravila koja se ovde nikad ne krše:
 *   1. Šifra partnera i PIB ostaju tekst. Nigde `Number(...)`.
 *   2. Naziv nikad nije ključ spajanja. Sličan naziv je napomena za čoveka.
 *   3. E-mail sa kartice nije ovlašćenje. Registar ga čuva kao podatak iz
 *      izvora; pravo prijave nastaje tek potvrdom osobe (vidi
 *      `lib/customers/contactVerification.mjs`).
 */

export class PartnerWorkbookError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = "PartnerWorkbookError";
  }
}

/** Kolone lista partnera u pripremnoj radnoj svesci — tačni nazivi. */
export const PARTNER_HEADERS = /** @type {const} */ ([
  "BizniSoft šifra",
  "Naziv",
  "PIB",
  "Mesto",
  "Adresa",
  "E-mail iz sistema",
  "Telefon",
  "Komercijalista (šifra)",
  "Aktivan",
  "Izvor",
  "Status",
]);

/** Kolone pomoćne liste. `ID iz druge liste` NIJE BizniSoft šifra. */
export const AUX_HEADERS = /** @type {const} */ ([
  "ID iz druge liste",
  "Naziv",
  "Mesto",
  "Ulica",
  "Broj",
  "Telefon",
  "E-mail",
  "Status adrese",
  "Status",
  "Napomena",
  "Izvor",
]);

/**
 * Profil pripremne radne sveske (septembar 2026).
 *
 * Ime lista NE određuje klasifikaciju — ona se izvodi iz podataka (šifra
 * komercijaliste). Ime lista se samo proverava, pa neslaganje postaje nalaz.
 */
export const PREP_WORKBOOK_PROFILE = Object.freeze({
  id: "prep_workbook_v1",
  partnerSheets: Object.freeze({
    "Kupci sa emailom": "rep_assigned_candidate",
    "Kupci bez emaila": "rep_assigned_candidate",
    "Za dodatnu proveru": "needs_review",
  }),
  auxSheet: "Pomocna lista 99",
});

/** @typedef {"rep_assigned_candidate" | "needs_review"} PartnerClassification */

/**
 * @typedef {object} PartnerRecord
 * @property {string} partnerCode
 * @property {string} name
 * @property {string | null} pib
 * @property {import("./pib.mjs").PibStatus} pibStatus
 * @property {string | null} city
 * @property {string | null} address
 * @property {string | null} emailRaw
 * @property {string[]} emails          sintaksno ispravne, mala slova
 * @property {string[]} invalidEmails
 * @property {string | null} phoneRaw
 * @property {string | null} phoneKey   samo cifre, nacionalni oblik
 * @property {string | null} repCode
 * @property {boolean | null} activeInSource
 * @property {string} sourceSheet
 * @property {number} sourceRow         1-bazirano, kako ga vidi čovek u Excelu
 * @property {PartnerClassification} classification
 */

/** @param {unknown} v */
function clean(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
}

const EMAIL_RE = /^[^@\s;,<>()]+@[^@\s;,<>()]+\.[a-z]{2,}$/;

/**
 * Deli polje e-pošte (ume da sadrži više adresa) i proverava oblik.
 * NE pogađa ispravku — neispravna adresa ostaje neispravna.
 *
 * @param {string | null} raw
 */
export function splitEmails(raw) {
  /** @type {string[]} */
  const emails = [];
  /** @type {string[]} */
  const invalid = [];
  if (!raw) return { emails, invalid };
  for (const part of raw.toLowerCase().split(/[;,\s]+/)) {
    if (!part) continue;
    if (EMAIL_RE.test(part)) {
      if (!emails.includes(part)) emails.push(part);
    } else invalid.push(part);
  }
  return { emails, invalid };
}

/**
 * Telefon kao ključ poređenja: samo cifre, `+381`/`00381` → `0`.
 * Kraći od 8 cifara nije dovoljno jedinstven da bi bio ključ.
 *
 * @param {string | null} raw
 */
export function phoneKey(raw) {
  if (!raw) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00381")) d = `0${d.slice(5)}`;
  else if (d.startsWith("381")) d = `0${d.slice(3)}`;
  return d.length >= 8 ? d : null;
}

/** @param {string | null} v */
function parseBool(v) {
  if (v === null) return null;
  const s = v.toLowerCase();
  if (s === "true" || s === "1" || s === "da") return true;
  if (s === "false" || s === "0" || s === "ne") return false;
  return null;
}

/**
 * Tabela → objekti po zaglavlju. Nedostajuća kolona obara uvoz: izvoz
 * promenjene strukture se ne tumači, nego se prijavljuje.
 *
 * @param {(string | null)[][]} rows
 * @param {readonly string[]} expected
 * @param {string} sheetName
 */
function rowsByHeader(rows, expected, sheetName) {
  const header = (rows[0] ?? []).map((h) => clean(h));
  const missing = expected.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    throw new PartnerWorkbookError(
      `List „${sheetName}" nema kolone: ${missing.join(", ")}. Struktura izvoza se promenila — uvoz je zaustavljen.`,
    );
  }
  /** @type {{ row: number, values: Record<string, string | null> }[]} */
  const out = [];
  for (let i = 1; i < rows.length; i += 1) {
    const r = rows[i] ?? [];
    if (!r.some((v) => clean(v) !== null)) continue;
    /** @type {Record<string, string | null>} */
    const values = {};
    header.forEach((h, idx) => {
      if (h) values[h] = clean(r[idx]);
    });
    out.push({ row: i + 1, values });
  }
  return out;
}

/**
 * @param {Record<string, string | null>} v
 * @param {string} sheet
 * @param {number} row
 * @returns {PartnerRecord}
 */
export function normalizePartner(v, sheet, row) {
  const partnerCode = v["BizniSoft šifra"];
  if (!partnerCode) {
    throw new PartnerWorkbookError(`List „${sheet}", red ${row}: nedostaje BizniSoft šifra.`);
  }
  const name = v["Naziv"];
  if (!name) {
    throw new PartnerWorkbookError(`List „${sheet}", red ${row}: nedostaje naziv partnera ${partnerCode}.`);
  }
  const pib = classifyPib(v["PIB"]);
  const { emails, invalid } = splitEmails(v["E-mail iz sistema"]);
  const repCode = v["Komercijalista (šifra)"];
  return {
    partnerCode,
    name,
    pib: pib.value,
    pibStatus: pib.status,
    city: v["Mesto"],
    address: v["Adresa"],
    emailRaw: v["E-mail iz sistema"],
    emails,
    invalidEmails: invalid,
    phoneRaw: v["Telefon"],
    phoneKey: phoneKey(v["Telefon"]),
    repCode,
    activeInSource: parseBool(v["Aktivan"]),
    sourceSheet: sheet,
    sourceRow: row,
    classification: repCode ? "rep_assigned_candidate" : "needs_review",
  };
}

/**
 * @typedef {object} AuxRecord
 * @property {string} auxId
 * @property {string} name
 * @property {string | null} city
 * @property {string | null} street
 * @property {string | null} phoneRaw
 * @property {string | null} phoneKey
 * @property {string[]} emails
 * @property {string | null} note
 * @property {number} sourceRow
 */

/**
 * Čita pripremnu radnu svesku.
 *
 * @param {{ name: string, rows: (string | null)[][] }[]} sheets
 * @param {typeof PREP_WORKBOOK_PROFILE} [profile]
 */
export function parsePartnerWorkbook(sheets, profile = PREP_WORKBOOK_PROFILE) {
  const byName = new Map(sheets.map((s) => [s.name, s]));
  /** @type {PartnerRecord[]} */
  const partners = [];
  /** @type {{ partnerCode: string, sheet: string, expected: string, derived: string }[]} */
  const sheetMismatches = [];

  for (const [sheetName, expected] of Object.entries(profile.partnerSheets)) {
    const sheet = byName.get(sheetName);
    if (!sheet) {
      throw new PartnerWorkbookError(`Nedostaje list „${sheetName}" (profil ${profile.id}).`);
    }
    for (const { row, values } of rowsByHeader(sheet.rows, PARTNER_HEADERS, sheetName)) {
      const p = normalizePartner(values, sheetName, row);
      if (p.classification !== expected) {
        sheetMismatches.push({
          partnerCode: p.partnerCode,
          sheet: sheetName,
          expected,
          derived: p.classification,
        });
      }
      partners.push(p);
    }
  }

  /** @type {AuxRecord[]} */
  const aux = [];
  const auxSheet = byName.get(profile.auxSheet);
  if (auxSheet) {
    for (const { row, values } of rowsByHeader(auxSheet.rows, AUX_HEADERS, profile.auxSheet)) {
      const auxId = values["ID iz druge liste"];
      const name = values["Naziv"];
      if (!auxId || !name) continue;
      aux.push({
        auxId,
        name,
        city: values["Mesto"],
        street: [values["Ulica"], values["Broj"]].filter(Boolean).join(" ") || null,
        phoneRaw: values["Telefon"],
        phoneKey: phoneKey(values["Telefon"]),
        emails: splitEmails(values["E-mail"]).emails,
        note: values["Napomena"],
        sourceRow: row,
      });
    }
  }

  return { profile: profile.id, partners, aux, sheetMismatches };
}

/* =========================================================================
 * Analiza: poslovnice, duplikati, deljeni kontakti
 * ====================================================================== */

/**
 * Naziv za POREĐENJE u napomenama — nikad za spajanje.
 * @param {string} name
 */
export function nameHintKey(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "dj")
    .toUpperCase()
    .replace(/\b(D\.?O\.?O\.?|SZR|STR|SZTR|PR|A\.?D\.?|DOO)\b/g, " ")
    .replace(/[^A-Z0-9]/g, "");
}

/** @param {string | null} city @param {string | null} address */
function addressKey(city, address) {
  if (!address) return null;
  const norm = (/** @type {string} */ s) =>
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toUpperCase()
      .replace(/\b(BR|BROJ|ULICA|UL)\b\.?/g, " ")
      .replace(/[^A-Z0-9]/g, "");
  // Prvih šest slova mesta: „BEOGRAD-ZEMUN" i „Beograd" su isto mesto za napomenu.
  const cityKey = city ? norm(city).slice(0, 6) : "";
  return `${cityKey}|${norm(address)}`;
}

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T) => string | null | readonly string[]} keyOf
 */
function groupBy(items, keyOf) {
  /** @type {Map<string, T[]>} */
  const groups = new Map();
  for (const item of items) {
    const k = keyOf(item);
    const keys = Array.isArray(k) ? k : k ? [k] : [];
    for (const key of keys) {
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
  }
  return groups;
}

/**
 * Nalazi nad registrom. Svaki nalaz nosi `severity`:
 *   - `blocking`: uvoz se ne sme primeniti (dupla šifra);
 *   - `review`: kancelarija mora pogledati pre nego što se partner poveže sa
 *     kupcem ili se njegovoj adresi izda poziv;
 *   - `hint`: pomoć čoveku, bez ikakvog automatskog dejstva.
 *
 * @param {PartnerRecord[]} partners
 */
export function analyzePartners(partners) {
  /** @type {{ kind: string, severity: "blocking" | "review" | "hint", partnerCodes: string[], detail: string }[]} */
  const findings = [];

  for (const [code, list] of groupBy(partners, (p) => p.partnerCode)) {
    if (list.length > 1) {
      findings.push({
        kind: "duplicate_partner_code",
        severity: "blocking",
        partnerCodes: [code],
        detail: `Šifra ${code} se pojavljuje ${list.length} puta (listovi: ${list.map((p) => p.sourceSheet).join(", ")}).`,
      });
    }
  }

  for (const p of partners) {
    if (p.pibStatus === "missing") {
      findings.push({ kind: "pib_missing", severity: "review", partnerCodes: [p.partnerCode], detail: "PIB nije upisan; kupac se ne može vezati za pravno lice dok se ne utvrdi." });
    } else if (p.pibStatus === "invalid_checksum") {
      findings.push({ kind: "pib_invalid_checksum", severity: "review", partnerCodes: [p.partnerCode], detail: "Devet cifara, ali kontrolna cifra ne odgovara — verovatno greška u unosu ili pomoćna šifra." });
    } else if (p.pibStatus === "nonstandard") {
      findings.push({ kind: "pib_nonstandard", severity: "review", partnerCodes: [p.partnerCode], detail: "Nije domaći PIB od 9 cifara (strani PDV broj ili nepotpun unos)." });
    }
    if (p.invalidEmails.length > 0) {
      findings.push({ kind: "email_invalid_syntax", severity: "review", partnerCodes: [p.partnerCode], detail: "Polje e-pošte sadrži vrednost koja nije ispravna adresa." });
    }
  }

  // Isti PIB, više šifara: poslovnica ILI duplikat kartice. Sistem ne bira.
  for (const [pib, list] of groupBy(
    partners.filter((p) => p.pibStatus === "valid"),
    (p) => p.pib,
  )) {
    if (list.length > 1) {
      findings.push({
        kind: "pib_shared_by_codes",
        severity: "review",
        partnerCodes: list.map((p) => p.partnerCode),
        detail: `PIB ${pib} ima ${list.length} šifre — poslovnice istog pravnog lica ili dupla kartica. Potvrditi pre povezivanja.`,
      });
    }
  }

  // Ista adresa e-pošte kod različitih partnera — ne sme postati login za oba.
  for (const [, list] of groupBy(partners, (p) => p.emails)) {
    if (list.length > 1) {
      const pibs = new Set(list.map((p) => p.pib ?? `?${p.partnerCode}`));
      findings.push({
        kind: pibs.size > 1 ? "email_shared_across_legal_entities" : "email_shared_within_legal_entity",
        severity: "review",
        partnerCodes: list.map((p) => p.partnerCode),
        detail:
          pibs.size > 1
            ? "Ista e-pošta upisana kod različitih pravnih lica (knjigovođa, vlasnik više firmi ili greška). Ne sme se koristiti za prijavu bez potvrde za koju firmu važi."
            : "Ista e-pošta kod više šifara istog PIB-a.",
      });
    }
  }

  // Ista adresa, različit PIB — često preuzimanje posla ili nova firma na istom mestu.
  for (const [, list] of groupBy(partners, (p) => addressKey(p.city, p.address))) {
    const pibs = new Set(list.map((p) => p.pib ?? `?${p.partnerCode}`));
    if (list.length > 1 && pibs.size > 1) {
      findings.push({
        kind: "address_shared_across_legal_entities",
        severity: "hint",
        partnerCodes: list.map((p) => p.partnerCode),
        detail: "Ista adresa, različit PIB — moguć naslednik, promena oblika (PR → DOO) ili dve firme na istom mestu. Nije osnov za spajanje.",
      });
    }
  }

  for (const [, list] of groupBy(partners, (p) => nameHintKey(p.name) || null)) {
    if (list.length > 1) {
      findings.push({
        kind: "similar_name",
        severity: "hint",
        partnerCodes: list.map((p) => p.partnerCode),
        detail: "Sličan naziv. Nije dokaz identiteta i nikad se ne spaja automatski.",
      });
    }
  }

  return findings;
}

/**
 * Brojke za izveštaj — iste one koje je priprema navela, izvedene iz podataka.
 * @param {PartnerRecord[]} partners
 * @param {AuxRecord[]} aux
 */
export function summarizePartners(partners, aux) {
  const candidates = partners.filter((p) => p.classification === "rep_assigned_candidate");
  const review = partners.filter((p) => p.classification === "needs_review");
  /** @type {Record<string, number>} */
  const byRep = {};
  for (const p of candidates) byRep[p.repCode ?? ""] = (byRep[p.repCode ?? ""] ?? 0) + 1;
  /** @type {Record<string, number>} */
  const byPib = {};
  for (const p of partners) byPib[p.pibStatus] = (byPib[p.pibStatus] ?? 0) + 1;
  return {
    partners: partners.length,
    repAssignedCandidates: candidates.length,
    candidatesWithEmail: candidates.filter((p) => p.emails.length > 0).length,
    candidatesWithoutEmail: candidates.filter((p) => p.emails.length === 0).length,
    needsReview: review.length,
    needsReviewWithEmail: review.filter((p) => p.emails.length > 0).length,
    candidatesByRepCode: byRep,
    pibStatus: byPib,
    auxiliary: aux.length,
  };
}

/* =========================================================================
 * Pomoćna lista: veza SAMO uz jak identifikator
 * ====================================================================== */

/**
 * Predlozi veze pomoćne liste sa registrom.
 *
 * `strong`: tačno ista e-pošta ili tačno isti telefon (≥ 8 cifara). I tada je
 * to PREDLOG za ručnu potvrdu — telefon ume da deli više firmi iste porodice.
 * `hint_only`: isti naziv posle normalizacije. Ne ulazi ni u jedan automatski
 * korak; služi kancelariji da zna gde da pogleda.
 *
 * @param {AuxRecord[]} aux
 * @param {PartnerRecord[]} partners
 */
export function matchAuxiliary(aux, partners) {
  const byEmail = groupBy(partners, (p) => p.emails);
  const byPhone = groupBy(partners, (p) => p.phoneKey);
  const byName = groupBy(partners, (p) => nameHintKey(p.name) || null);

  /** @type {{ auxId: string, auxName: string, partnerCode: string, partnerName: string, basis: "email" | "phone" | "name", strength: "strong" | "hint_only" }[]} */
  const links = [];
  for (const a of aux) {
    const seen = new Set();
    for (const e of a.emails) {
      for (const p of byEmail.get(e) ?? []) {
        links.push({ auxId: a.auxId, auxName: a.name, partnerCode: p.partnerCode, partnerName: p.name, basis: "email", strength: "strong" });
        seen.add(p.partnerCode);
      }
    }
    if (a.phoneKey) {
      for (const p of byPhone.get(a.phoneKey) ?? []) {
        if (seen.has(p.partnerCode)) continue;
        links.push({ auxId: a.auxId, auxName: a.name, partnerCode: p.partnerCode, partnerName: p.name, basis: "phone", strength: "strong" });
        seen.add(p.partnerCode);
      }
    }
    const key = nameHintKey(a.name);
    for (const p of (key && byName.get(key)) || []) {
      if (seen.has(p.partnerCode)) continue;
      links.push({ auxId: a.auxId, auxName: a.name, partnerCode: p.partnerCode, partnerName: p.name, basis: "name", strength: "hint_only" });
    }
  }
  return links;
}

/* =========================================================================
 * Radna lista za potvrdu kontakata
 * ====================================================================== */

export const CONTACT_WORKLIST_HEADERS = /** @type {const} */ ([
  "BizniSoft šifra",
  "Naziv",
  "PIB",
  "Mesto",
  "Komercijalista (šifra)",
  "Klasifikacija",
  "E-mail iz sistema",
  "Stanje e-maila",
  "Napomene iz analize",
  "Predložen kontakt (e-mail)",
  "Izvor predloga (URL ili opis)",
  "Pouzdanost predloga (A/B/C)",
  "Ovlašćena osoba (ime i funkcija)",
  "Način potvrde",
  "Potvrdio (ime)",
  "Datum potvrde",
]);

/**
 * Jedan red po partneru. Kolone od „Predložen kontakt" nadalje popunjava
 * čovek; generator ih ostavlja prazne i NIKAD ne upisuje nagađanu adresu.
 *
 * @param {PartnerRecord[]} partners
 * @param {ReturnType<typeof analyzePartners>} findings
 */
export function contactWorklist(partners, findings) {
  /** @type {Map<string, string[]>} */
  const notes = new Map();
  for (const f of findings) {
    if (f.severity === "hint" && f.kind !== "similar_name") continue;
    for (const code of f.partnerCodes) {
      const list = notes.get(code) ?? [];
      if (!list.includes(f.kind)) list.push(f.kind);
      notes.set(code, list);
    }
  }
  const shared = new Set(
    findings
      .filter((f) => f.kind === "email_shared_across_legal_entities")
      .flatMap((f) => f.partnerCodes),
  );

  return partners.map((p) => [
    p.partnerCode,
    p.name,
    p.pib ?? "",
    p.city ?? "",
    p.repCode ?? "",
    p.classification,
    p.emails.join("; "),
    p.emails.length === 0
      ? "nema — pribaviti od firme"
      : shared.has(p.partnerCode)
        ? "deljen sa drugom firmom — potvrditi za koju važi"
        : "evidentiran — vlasništvo i ovlašćenje nisu potvrđeni",
    (notes.get(p.partnerCode) ?? []).join(", "),
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
}

/**
 * CSV za Excel (UTF-8 sa BOM, `;` kao separator — srpski Excel ga tako otvara).
 * @param {readonly string[]} headers
 * @param {string[][]} rows
 */
export function toCsv(headers, rows) {
  const cell = (/** @type {string} */ v) => {
    let s = String(v ?? "");
    // Ćelija koja počinje formulom postaje formula u Excelu — neutralizuje se.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${[headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n")}\r\n`;
}

/* =========================================================================
 * Razlika dva uvoza: promene naziva, PIB-a, komercijaliste
 * ====================================================================== */

/**
 * Šta se promenilo između dva snimka istog izvora.
 *
 * Promena PIB-a pod istom šifrom je `critical`: kartica je prepisana drugim
 * pravnim licem, a nalozi i cene vezani za tu šifru bi tiho prešli na drugu
 * firmu. Promena naziva je obično preimenovanje i samo se beleži.
 *
 * @param {Pick<PartnerRecord, "partnerCode" | "name" | "pib" | "repCode" | "emails">[]} previous
 * @param {Pick<PartnerRecord, "partnerCode" | "name" | "pib" | "repCode" | "emails">[]} current
 */
export function diffPartnerSnapshots(previous, current) {
  const prev = new Map(previous.map((p) => [p.partnerCode, p]));
  const cur = new Map(current.map((p) => [p.partnerCode, p]));
  /** @type {{ partnerCode: string, change: string, severity: "critical" | "review" | "info", before: unknown, after: unknown }[]} */
  const changes = [];
  for (const [code, c] of cur) {
    const p = prev.get(code);
    if (!p) {
      changes.push({ partnerCode: code, change: "added", severity: "info", before: null, after: c.name });
      continue;
    }
    if ((p.pib ?? null) !== (c.pib ?? null)) {
      changes.push({ partnerCode: code, change: "pib_changed", severity: "critical", before: p.pib, after: c.pib });
    }
    if (p.name !== c.name) {
      changes.push({ partnerCode: code, change: "name_changed", severity: "info", before: p.name, after: c.name });
    }
    if ((p.repCode ?? null) !== (c.repCode ?? null)) {
      changes.push({ partnerCode: code, change: "rep_changed", severity: "review", before: p.repCode, after: c.repCode });
    }
    if (p.emails.join(";") !== c.emails.join(";")) {
      changes.push({ partnerCode: code, change: "email_changed", severity: "review", before: p.emails, after: c.emails });
    }
  }
  for (const [code, p] of prev) {
    if (!cur.has(code)) {
      changes.push({ partnerCode: code, change: "removed", severity: "review", before: p.name, after: null });
    }
  }
  return changes;
}
