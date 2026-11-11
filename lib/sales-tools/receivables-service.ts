import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { readXlsxCells, XlsxReadError } from "@/lib/import/xlsx/readXlsx.mjs";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { readSheets, SheetReadError, sheetConfig } from "@/lib/sales-tools/googleSheets.mjs";
import { matchCustomer, repForSheet } from "@/lib/sales-tools/customerMatch.mjs";
import { daysOverdue, nameKey, parseReceivables } from "@/lib/sales-tools/receivablesParse.mjs";
import { CsvReadError, readCsvGrid } from "@/lib/stock/csvGrid.mjs";

/**
 * Dugovanja kupaca iz tabele kancelarije (0061; 2026-11-10).
 *
 * Izvor je Google tabela u kojoj kancelarija vodi neplaćene i delimično plaćene fakture
 * (samo čitanje, servisni nalog), ili isti sadržaj otpremljen kao XLSX/CSV. Svako čitanje
 * se poredi sa poslednjim snimkom: isti sadržaj → samo novo vreme provere; promena → nov snimak.
 *
 * Kupac se prepoznaje redom: PIB → šifra partnera (BizniSoft kartica → PIB) → jedinstven naziv.
 * Nepovezani redovi ostaju u snimku i vide ih vlasnik i kancelarija.
 */

export class ReceivablesError extends Error {}

/** Posle koliko minuta se tabela ponovo čita kada neko otvori ekran. */
const AUTO_REFRESH_MINUTES = 20;
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function receivablesSourceConfigured() {
  return sheetConfig() !== null;
}

type Snapshot = { id: string; source: string; sourceRef: string; createdAt: string; checkedAt: string; rowCount: number; matchedCount: number; totalRemaining: number; warnings: { row: number; text: string }[] };

export async function latestSnapshot(): Promise<Snapshot | null> {
  const [r] = [
    ...(await getDb().execute<{ id: string; source: string; source_ref: string; created_at: string; checked_at: string; row_count: number; matched_count: number; total: string; warnings: { row: number; text: string }[] }>(sql`
      SELECT id, source, source_ref, created_at::text, checked_at::text, row_count, matched_count, total_remaining::text AS total, warnings
        FROM receivable_snapshots ORDER BY created_at DESC, id DESC LIMIT 1`)),
  ];
  return r
    ? { id: r.id, source: r.source, sourceRef: r.source_ref, createdAt: r.created_at, checkedAt: r.checked_at, rowCount: r.row_count, matchedCount: r.matched_count, totalRemaining: Number(r.total), warnings: r.warnings ?? [] }
    : null;
}

type Exec = Pick<ReturnType<typeof getDb>, "execute">;

/** Jedna pročitana tabela: naziv („Milan“ = tabela tog komercijaliste) i ćelije. */
export type SheetGrid = { label: string; grid: unknown[][] };

/** Broj reda u snimku: redni broj tabele × 100000 + red (tabele se ne sudaraju). */
const ROW_SPAN = 100_000;

/**
 * Povezivanje naziva sa kupcima (u transakciji upisa — prima izvršioca):
 * PIB → šifra partnera → naziv (prvo među kupcima komercijaliste čija je tabela).
 * Ručne veze (`receivable_customer_links`) se NE upisuju ovde — imaju prednost pri čitanju.
 */
async function customerMatcher(db: Exec, codes: string[]) {
  const [customers, reps, assignments] = await Promise.all([
    db.execute<{ id: string; pib: string; name: string; city: string | null }>(sql`SELECT id, pib, name, city FROM customers`),
    db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM users WHERE role = 'komercijalista' AND active`),
    db.execute<{ user_id: string; customer_id: string }>(sql`SELECT user_id, customer_id FROM customer_assignments`),
  ]);
  const list = [...customers];
  const byPib = new Map(list.map((c) => [c.pib, c.id]));
  const codePib = new Map<string, string>();
  if (codes.length) {
    for (const r of await db.execute<{ code: string; pib: string | null }>(sql`
      SELECT partner_code AS code, pib FROM current_partner_records WHERE partner_code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`)) {
      if (r.pib) codePib.set(r.code, r.pib);
    }
  }
  const byRep = new Map<string, Set<string>>();
  for (const a of assignments) {
    const set = byRep.get(a.user_id) ?? new Set<string>();
    set.add(a.customer_id);
    byRep.set(a.user_id, set);
  }
  const repList = [...reps];
  const cache = new Map<string, string | null>();
  return (sheetLabel: string, l: { customerLabel: string; pib?: string | null; partnerCode?: string | null }) => {
    if (l.pib && byPib.has(l.pib)) return byPib.get(l.pib)!;
    if (l.partnerCode && codePib.has(l.partnerCode) && byPib.has(codePib.get(l.partnerCode)!)) return byPib.get(codePib.get(l.partnerCode)!)!;
    const key = `${sheetLabel}|${l.customerLabel}`;
    if (!cache.has(key)) {
      const rep = repForSheet(sheetLabel, repList);
      cache.set(key, matchCustomer(l.customerLabel, list, rep ? byRep.get(rep.id) ?? new Set() : new Set()));
    }
    return cache.get(key) ?? null;
  };
}

/**
 * Snimak + kreditna upozorenja (0063): posle promene sadržaja tabele proveravaju se limiti.
 * `triggeredBy` je korisnik čije je otvaranje ekrana ili dugme pokrenulo čitanje — upisuje se
 * kao onaj ko je zatvorio upozorenje koje više ne važi.
 */
async function store(source: "google_sheet" | "upload", sourceRef: string, sheets: SheetGrid[], actorId: string | null, triggeredBy: string | null = actorId) {
  const result = await storeSnapshot(source, sourceRef, sheets, actorId);
  if (result.changed) {
    try {
      const { evaluateCreditWarnings } = await import("@/lib/credit/credit-service");
      await evaluateCreditWarnings(triggeredBy);
    } catch (error) {
      // Upozorenja ne smeju oboriti čitanje tabele; greška se vidi u logu.
      console.error("kreditna upozorenja:", error);
    }
  }
  return result;
}

async function storeSnapshot(source: "google_sheet" | "upload", sourceRef: string, sheets: SheetGrid[], actorId: string | null) {
  const parsed = sheets.map((sh) => ({ ...sh, result: parseReceivables(sh.grid) }));
  const bad = parsed.find((p) => !p.result.ok);
  if (bad) throw new ReceivablesError(`Tabela „${bad.label}“: ${bad.result.error ?? "nije pročitana."}`);
  const sha = createHash("sha256").update(JSON.stringify(sheets)).digest("hex");
  const lineCount = parsed.reduce((s, p) => s + p.result.lines.length, 0);
  const warnCount = parsed.reduce((s, p) => s + p.result.warnings.length, 0);
  const db = getDb();
  return db.transaction(async (tx) => {
    // Dva istovremena čitanja (dva komercijalista otvore ekran) ne prave dva snimka.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('receivable_snapshots'))`);
    const [last] = [...(await tx.execute<{ id: string; sha: string }>(sql`
      SELECT id, content_sha256 AS sha FROM receivable_snapshots ORDER BY created_at DESC, id DESC LIMIT 1`))];
    if (last && last.sha === sha) {
      await tx.execute(sql`UPDATE receivable_snapshots SET checked_at = now() WHERE id = ${last.id}::uuid`);
      return { snapshotId: last.id, changed: false, lines: lineCount, warnings: warnCount };
    }
    const codes = [...new Set(parsed.flatMap((p) => p.result.lines.map((l) => l.partnerCode)).filter((c): c is string => Boolean(c)))];
    const match = await customerMatcher(tx, codes);
    const lines = parsed.flatMap((p, i) =>
      p.result.lines.map((l) => ({ l, row: i * ROW_SPAN + l.row, label: p.label, customerId: match(p.label, l) })),
    );
    const roster = parsed.flatMap((p, i) =>
      p.result.customers.map((c) => ({ row: i * ROW_SPAN + c.row, label: p.label, customerLabel: c.label, customerId: match(p.label, { customerLabel: c.label }) })),
    );
    const total = lines.reduce((s, x) => s + x.l.remaining, 0);
    const warnings = parsed.flatMap((p) => p.result.warnings.map((w) => ({ row: w.row, text: sheets.length > 1 ? `${p.label}: ${w.text}` : w.text }))).slice(0, 200);
    const [snap] = [...(await tx.execute<{ id: string }>(sql`
      INSERT INTO receivable_snapshots (source, source_ref, content_sha256, row_count, matched_count, total_remaining, warnings, created_by)
      VALUES (${source}, ${sourceRef.slice(0, 200)}, ${sha}, ${lines.length}, ${lines.filter((x) => x.customerId).length},
              ${total.toFixed(2)}, ${JSON.stringify(warnings)}::jsonb, ${actorId}::uuid)
      RETURNING id`))];
    for (let i = 0; i < lines.length; i += 200) {
      await tx.execute(sql`
        INSERT INTO receivable_lines (snapshot_id, row_number, customer_id, customer_label, pib, partner_code, invoice_number, issued_on, due_on, amount, paid, remaining, note, source_label, label_key)
        VALUES ${sql.join(
          lines.slice(i, i + 200).map(
            ({ l, row, label, customerId }) =>
              sql`(${snap.id}::uuid, ${row}, ${customerId}::uuid, ${l.customerLabel.slice(0, 200)}, ${l.pib}, ${l.partnerCode}, ${l.invoiceNumber},
                   ${l.issuedOn}::date, ${l.dueOn}::date, ${l.amount === null ? null : l.amount.toFixed(2)}, ${l.paid === null ? null : l.paid.toFixed(2)},
                   ${l.remaining.toFixed(2)}, ${l.note}, ${label}, ${nameKey(l.customerLabel, { keepPlace: true }).slice(0, 200)})`,
          ),
          sql`, `,
        )}`);
    }
    for (let i = 0; i < roster.length; i += 300) {
      await tx.execute(sql`
        INSERT INTO receivable_sheet_customers (snapshot_id, row_number, source_label, customer_label, label_key, customer_id)
        VALUES ${sql.join(
          roster.slice(i, i + 300).map(
            (r) => sql`(${snap.id}::uuid, ${r.row}, ${r.label}, ${r.customerLabel.slice(0, 200)}, ${nameKey(r.customerLabel, { keepPlace: true }).slice(0, 200)}, ${r.customerId}::uuid)`,
          ),
          sql`, `,
        )}`);
    }
    return { snapshotId: snap.id, changed: true, lines: lineCount, warnings: warnCount };
  });
}

/** Čitanje Google tabela (dugme „Osveži“ ili automatski posle AUTO_REFRESH_MINUTES). */
export async function refreshFromGoogle(actorId: string | null, triggeredBy: string | null = actorId) {
  const cfg = sheetConfig();
  if (!cfg) throw new ReceivablesError("Google tabela još nije povezana.");
  let sheets: SheetGrid[];
  try {
    sheets = (await readSheets(cfg)).map((s) => ({ label: s.title, grid: s.values }));
  } catch (error) {
    if (error instanceof SheetReadError) throw new ReceivablesError(error.message);
    throw new ReceivablesError("Google tabela trenutno nije dostupna. Prikazano je poslednje sačuvano stanje.");
  }
  return store("google_sheet", `google: ${sheets.map((s) => s.label).join(", ")}`, sheets, actorId, triggeredBy);
}

/**
 * Pre prikaza: ako je povezana Google tabela i stanje je starije od AUTO_REFRESH_MINUTES,
 * pročita je. Nikad ne baca — vraća poruku koju ekran prikaže uz staro stanje.
 */
export async function autoRefreshReceivables(triggeredBy: string | null = null): Promise<string | null> {
  if (!receivablesSourceConfigured()) return null;
  const last = await latestSnapshot();
  if (last && last.source === "google_sheet" && Date.now() - Date.parse(last.checkedAt) < AUTO_REFRESH_MINUTES * 60_000) return null;
  try {
    await refreshFromGoogle(null, triggeredBy);
    return null;
  } catch (error) {
    return error instanceof ReceivablesError ? error.message : "Google tabela trenutno nije dostupna. Prikazano je poslednje sačuvano stanje.";
  }
}

/** Otpremljen XLSX/CSV (rezerva ako Google tabela nije povezana). Prvi list sa zaglavljem dugovanja. */
export async function importReceivablesFile(actor: Pick<PortalUser, "id">, fileName: string, bytes: Uint8Array) {
  const buf = Buffer.from(bytes);
  if (!buf.length) throw new ReceivablesError("Fajl je prazan.");
  if (buf.length > MAX_FILE_BYTES) throw new ReceivablesError("Fajl je veći od 4 MB.");
  let grid: unknown[][];
  try {
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      const sheets = readXlsxCells(buf);
      const pick = sheets.find((s) => parseReceivables(s.rows).ok);
      if (!pick) throw new ReceivablesError("Ni na jednom listu nije pronađeno zaglavlje dugovanja (kupac i iznos/ostatak).");
      grid = pick.rows;
    } else {
      grid = readCsvGrid(buf).rows;
    }
  } catch (error) {
    if (error instanceof XlsxReadError || error instanceof CsvReadError) throw new ReceivablesError("Fajl nije čitljiv (očekuje se XLSX ili CSV).");
    throw error;
  }
  // Naziv fajla („Milan.xlsx“) je naziv tabele = komercijalista.
  const label = fileName.replace(/\.[a-z0-9]+$/i, "").trim().slice(0, 80) || "fajl";
  return store("upload", fileName.slice(0, 120) || "fajl", [{ label, grid }], actor.id);
}

export type CustomerDebt = {
  customerId: string;
  customerName: string;
  invoices: number;
  total: number;
  overdueTotal: number;
  overdueInvoices: number;
  maxDaysOverdue: number | null;
  oldestIssuedOn: string | null;
};

/** Kupac reda: ručna veza (0062) ima prednost nad automatskim poklapanjem. */
const EFFECTIVE = sql`coalesce(k.customer_id, l.customer_id)`;
const LINKS = sql`LEFT JOIN receivable_customer_links k ON k.label_key = l.label_key`;

/** Zbir po kupcu u opsegu korisnika (poslednji snimak). */
export async function debtsByCustomer(viewer: PortalUser, today = belgradeDate(new Date())): Promise<CustomerDebt[]> {
  const scope = await resolveLedgerScope(viewer);
  return debtsInScope(scope.customerIds, today);
}

/** Svi kupci, bez opsega korisnika — samo za sistemske provere (kreditna upozorenja, 0063). */
export async function debtsForAllCustomers(today = belgradeDate(new Date())): Promise<CustomerDebt[]> {
  return debtsInScope(null, today);
}

async function debtsInScope(customerIds: string[] | null, today: string): Promise<CustomerDebt[]> {
  const last = await latestSnapshot();
  if (!last) return [];
  const scope = { customerIds };
  if (scope.customerIds !== null && scope.customerIds.length === 0) return [];
  const inScope = scope.customerIds === null ? sql`true` : sql`${EFFECTIVE} IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
  const rows = await getDb().execute<{ id: string; name: string; n: number; total: string; od_total: string; od_n: number; max_od: number | null; oldest: string | null }>(sql`
    SELECT c.id, c.name, count(*)::int AS n, sum(l.remaining)::text AS total,
           coalesce(sum(l.remaining) FILTER (WHERE l.due_on < ${today}::date), 0)::text AS od_total,
           count(*) FILTER (WHERE l.due_on < ${today}::date)::int AS od_n,
           max(${today}::date - l.due_on) FILTER (WHERE l.due_on < ${today}::date) AS max_od,
           min(l.issued_on)::text AS oldest
      FROM receivable_lines l ${LINKS} JOIN customers c ON c.id = ${EFFECTIVE}
     WHERE l.snapshot_id = ${last.id}::uuid AND ${inScope}
     GROUP BY c.id, c.name`);
  return [...rows].map((r) => ({
    customerId: r.id,
    customerName: r.name,
    invoices: r.n,
    total: Number(r.total),
    overdueTotal: Number(r.od_total),
    overdueInvoices: r.od_n,
    maxDaysOverdue: r.max_od,
    oldestIssuedOn: r.oldest,
  }));
}

export type DebtLine = { invoiceNumber: string | null; issuedOn: string | null; dueOn: string | null; amount: number | null; paid: number | null; remaining: number; daysOverdue: number | null; note: string | null };

const toLine = (r: { inv: string | null; issued: string | null; due: string | null; amount: string | null; paid: string | null; rem: string; note: string | null }, today: string): DebtLine => ({
  invoiceNumber: r.inv,
  issuedOn: r.issued,
  dueOn: r.due,
  amount: r.amount === null ? null : Number(r.amount),
  paid: r.paid === null ? null : Number(r.paid),
  remaining: Number(r.rem),
  daysOverdue: daysOverdue(r.due, today),
  note: r.note,
});

/** Fakture jednog kupca (opseg proverava pozivalac). */
export async function customerDebtLines(customerId: string, today = belgradeDate(new Date())) {
  const last = await latestSnapshot();
  if (!last) return { snapshot: null, lines: [] as DebtLine[] };
  const rows = await getDb().execute<{ inv: string | null; issued: string | null; due: string | null; amount: string | null; paid: string | null; rem: string; note: string | null }>(sql`
    SELECT l.invoice_number AS inv, l.issued_on::text AS issued, l.due_on::text AS due, l.amount::text, l.paid::text, l.remaining::text AS rem, l.note
      FROM receivable_lines l ${LINKS}
     WHERE l.snapshot_id = ${last.id}::uuid AND ${EFFECTIVE} = ${customerId}::uuid
     ORDER BY l.due_on NULLS LAST, l.issued_on NULLS LAST, l.row_number`);
  return { snapshot: last, lines: [...rows].map((r) => toLine(r, today)) };
}

/**
 * Nazivi iz tabela koje portal nije povezao sa kupcem (vlasnik i kancelarija): i kupci bez duga
 * (iz spiska), da se povežu jednom. Prvo oni sa dugom.
 */
export async function unmatchedDebtLines() {
  const last = await latestSnapshot();
  if (!last) return [];
  const rows = await getDb().execute<{ key: string; label: string; sheet: string | null; n: number; total: string | null }>(sql`
    WITH names AS (
      SELECT l.label_key AS key, min(l.customer_label) AS label, min(l.source_label) AS sheet, count(*)::int AS n, sum(l.remaining) AS total
        FROM receivable_lines l ${LINKS}
       WHERE l.snapshot_id = ${last.id}::uuid AND ${EFFECTIVE} IS NULL AND l.label_key IS NOT NULL
       GROUP BY l.label_key
      UNION ALL
      SELECT r.label_key, min(r.customer_label), min(r.source_label), 0, NULL
        FROM receivable_sheet_customers r LEFT JOIN receivable_customer_links k ON k.label_key = r.label_key
       WHERE r.snapshot_id = ${last.id}::uuid AND coalesce(k.customer_id, r.customer_id) IS NULL
       GROUP BY r.label_key
    )
    SELECT key, min(label) AS label, min(sheet) AS sheet, max(n)::int AS n, max(total)::text AS total
      FROM names GROUP BY key ORDER BY max(coalesce(total, 0)) DESC, min(label)`);
  return [...rows].map((r) => ({ key: r.key, label: r.label, sheet: r.sheet, invoices: r.n, total: Number(r.total ?? 0) }));
}

/** Kupci za ručno povezivanje (padajući spisak). */
export async function customersForLinking() {
  const rows = await getDb().execute<{ id: string; name: string; city: string | null }>(sql`SELECT id, name, city FROM customers WHERE active ORDER BY name`);
  return [...rows];
}

/** Ručna veza „naziv iz tabele → kupac“ (vlasnik i kancelarija). Ponovna veza istog naziva menja kupca. */
export async function linkSheetLabel(actor: Pick<PortalUser, "id">, input: { key: string; customerId: string }) {
  const key = String(input.key ?? "").trim().slice(0, 200);
  if (!key) throw new ReceivablesError("Nedostaje naziv iz tabele.");
  const db = getDb();
  const [c] = [...(await db.execute<{ id: string }>(sql`SELECT id FROM customers WHERE id = ${input.customerId}::uuid`))];
  if (!c) throw new ReceivablesError("Kupac ne postoji.");
  const last = await latestSnapshot();
  const [example] = last
    ? [...(await db.execute<{ label: string }>(sql`
        SELECT customer_label AS label FROM receivable_sheet_customers WHERE snapshot_id = ${last.id}::uuid AND label_key = ${key}
        UNION ALL SELECT customer_label FROM receivable_lines WHERE snapshot_id = ${last.id}::uuid AND label_key = ${key} LIMIT 1`))]
    : [];
  await db.execute(sql`
    INSERT INTO receivable_customer_links (label_key, customer_id, label_example, created_by)
    VALUES (${key}, ${c.id}::uuid, ${example?.label ?? key}, ${actor.id}::uuid)
    ON CONFLICT (label_key) DO UPDATE SET customer_id = EXCLUDED.customer_id, created_by = EXCLUDED.created_by, created_at = now()`);
}

export type SheetAssignment = {
  customerId: string;
  customerName: string;
  sheet: string;
  repId: string;
  repName: string;
  current: { id: string; name: string }[];
};

/**
 * „Čiji je kupac“: kupac je u tabeli komercijaliste X, a u portalu nije dodeljen X-u.
 * Samo predlog — dodelu potvrđuje vlasnik (`assignments:manage`).
 */
export async function sheetAssignmentSuggestions(): Promise<SheetAssignment[]> {
  const last = await latestSnapshot();
  if (!last) return [];
  const db = getDb();
  const [roster, reps, assigned] = await Promise.all([
    db.execute<{ cid: string; name: string; sheet: string }>(sql`
      SELECT DISTINCT coalesce(k.customer_id, r.customer_id) AS cid, c.name, r.source_label AS sheet
        FROM receivable_sheet_customers r
        LEFT JOIN receivable_customer_links k ON k.label_key = r.label_key
        JOIN customers c ON c.id = coalesce(k.customer_id, r.customer_id)
       WHERE r.snapshot_id = ${last.id}::uuid`),
    db.execute<{ id: string; name: string }>(sql`SELECT id, name FROM users WHERE role = 'komercijalista' AND active`),
    db.execute<{ cid: string; uid: string; name: string }>(sql`
      SELECT a.customer_id AS cid, u.id AS uid, u.name FROM customer_assignments a JOIN users u ON u.id = a.user_id`),
  ]);
  const repList = [...reps];
  const byCustomer = new Map<string, { id: string; name: string }[]>();
  for (const a of assigned) byCustomer.set(a.cid, [...(byCustomer.get(a.cid) ?? []), { id: a.uid, name: a.name }]);
  const out: SheetAssignment[] = [];
  const seen = new Set<string>();
  for (const r of roster) {
    const rep = repForSheet(r.sheet, repList);
    if (!rep) continue;
    const current = byCustomer.get(r.cid) ?? [];
    if (current.some((c) => c.id === rep.id) || seen.has(`${r.cid}|${rep.id}`)) continue;
    seen.add(`${r.cid}|${rep.id}`);
    out.push({ customerId: r.cid, customerName: r.name, sheet: r.sheet, repId: rep.id, repName: rep.name, current });
  }
  return out.sort((a, b) => a.repName.localeCompare(b.repName, "sr-Latn") || a.customerName.localeCompare(b.customerName, "sr-Latn"));
}
