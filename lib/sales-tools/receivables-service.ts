import "server-only";
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { PortalUser } from "@/lib/authz/user-repository";
import { readXlsxCells, XlsxReadError } from "@/lib/import/xlsx/readXlsx.mjs";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { readSheetValues, SheetReadError, sheetConfig } from "@/lib/sales-tools/googleSheets.mjs";
import { daysOverdue, nameKey, parseReceivables, type ReceivableLine } from "@/lib/sales-tools/receivablesParse.mjs";
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

/** Povezivanje redova sa kupcima (u transakciji upisa — prima izvršioca). */
async function matchCustomers(db: Exec, lines: ReceivableLine[]) {
  const customers = [...(await db.execute<{ id: string; pib: string; name: string }>(sql`SELECT id, pib, name FROM customers`))];
  const byPib = new Map(customers.map((c) => [c.pib, c.id]));
  const byName = new Map<string, string | null>();
  for (const c of customers) {
    const k = nameKey(c.name);
    byName.set(k, byName.has(k) ? null : c.id); // dvosmislen naziv → bez povezivanja
  }
  const codes = [...new Set(lines.map((l) => l.partnerCode).filter((c): c is string => Boolean(c)))];
  const codePib = new Map<string, string>();
  if (codes.length) {
    for (const r of await db.execute<{ code: string; pib: string | null }>(sql`
      SELECT partner_code AS code, pib FROM current_partner_records WHERE partner_code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`)) {
      if (r.pib) codePib.set(r.code, r.pib);
    }
  }
  return lines.map((l) => {
    const viaPib = l.pib ? byPib.get(l.pib) : undefined;
    const viaCode = l.partnerCode && codePib.has(l.partnerCode) ? byPib.get(codePib.get(l.partnerCode)!) : undefined;
    const viaName = byName.get(nameKey(l.customerLabel)) ?? undefined;
    return { line: l, customerId: viaPib ?? viaCode ?? viaName ?? null };
  });
}

async function store(source: "google_sheet" | "upload", sourceRef: string, grid: unknown[][], actorId: string | null) {
  const parsed = parseReceivables(grid);
  if (!parsed.ok) throw new ReceivablesError(parsed.error ?? "Tabela nije pročitana.");
  const sha = createHash("sha256").update(JSON.stringify(grid)).digest("hex");
  const db = getDb();
  return db.transaction(async (tx) => {
    // Dva istovremena čitanja (dva komercijalista otvore ekran) ne prave dva snimka.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('receivable_snapshots'))`);
    const [last] = [...(await tx.execute<{ id: string; sha: string }>(sql`
      SELECT id, content_sha256 AS sha FROM receivable_snapshots ORDER BY created_at DESC, id DESC LIMIT 1`))];
    if (last && last.sha === sha) {
      await tx.execute(sql`UPDATE receivable_snapshots SET checked_at = now() WHERE id = ${last.id}::uuid`);
      return { snapshotId: last.id, changed: false, lines: parsed.lines.length, warnings: parsed.warnings.length };
    }
    const matched = await matchCustomers(tx, parsed.lines);
    const total = parsed.lines.reduce((s, l) => s + l.remaining, 0);
    const warnings = parsed.warnings.slice(0, 200);
    const [snap] = [...(await tx.execute<{ id: string }>(sql`
      INSERT INTO receivable_snapshots (source, source_ref, content_sha256, row_count, matched_count, total_remaining, warnings, created_by)
      VALUES (${source}, ${sourceRef.slice(0, 200)}, ${sha}, ${parsed.lines.length}, ${matched.filter((m) => m.customerId).length},
              ${total.toFixed(2)}, ${JSON.stringify(warnings)}::jsonb, ${actorId}::uuid)
      RETURNING id`))];
    for (let i = 0; i < matched.length; i += 200) {
      const chunk = matched.slice(i, i + 200);
      await tx.execute(sql`
        INSERT INTO receivable_lines (snapshot_id, row_number, customer_id, customer_label, pib, partner_code, invoice_number, issued_on, due_on, amount, paid, remaining, note)
        VALUES ${sql.join(
          chunk.map(
            ({ line: l, customerId }) =>
              sql`(${snap.id}::uuid, ${l.row}, ${customerId}::uuid, ${l.customerLabel.slice(0, 200)}, ${l.pib}, ${l.partnerCode}, ${l.invoiceNumber},
                   ${l.issuedOn}::date, ${l.dueOn}::date, ${l.amount === null ? null : l.amount.toFixed(2)}, ${l.paid === null ? null : l.paid.toFixed(2)},
                   ${l.remaining.toFixed(2)}, ${l.note})`,
          ),
          sql`, `,
        )}`);
    }
    return { snapshotId: snap.id, changed: true, lines: parsed.lines.length, warnings: parsed.warnings.length };
  });
}

/** Čitanje Google tabele (dugme „Osveži“ ili automatski posle AUTO_REFRESH_MINUTES). */
export async function refreshFromGoogle(actorId: string | null) {
  const cfg = sheetConfig();
  if (!cfg) throw new ReceivablesError("Google tabela još nije povezana.");
  let grid: (string | number | null)[][];
  try {
    grid = await readSheetValues(cfg);
  } catch (error) {
    if (error instanceof SheetReadError) throw new ReceivablesError(error.message);
    throw new ReceivablesError("Google tabela trenutno nije dostupna. Prikazano je poslednje sačuvano stanje.");
  }
  return store("google_sheet", `google:${cfg.id.slice(0, 6)}…`, grid, actorId);
}

/**
 * Pre prikaza: ako je povezana Google tabela i stanje je starije od AUTO_REFRESH_MINUTES,
 * pročita je. Nikad ne baca — vraća poruku koju ekran prikaže uz staro stanje.
 */
export async function autoRefreshReceivables(): Promise<string | null> {
  if (!receivablesSourceConfigured()) return null;
  const last = await latestSnapshot();
  if (last && last.source === "google_sheet" && Date.now() - Date.parse(last.checkedAt) < AUTO_REFRESH_MINUTES * 60_000) return null;
  try {
    await refreshFromGoogle(null);
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
  return store("upload", fileName.slice(0, 120) || "fajl", grid, actor.id);
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

/** Zbir po kupcu u opsegu korisnika (poslednji snimak). */
export async function debtsByCustomer(viewer: PortalUser, today = belgradeDate(new Date())): Promise<CustomerDebt[]> {
  const last = await latestSnapshot();
  if (!last) return [];
  const scope = await resolveLedgerScope(viewer);
  if (scope.customerIds !== null && scope.customerIds.length === 0) return [];
  const inScope = scope.customerIds === null ? sql`true` : sql`l.customer_id IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
  const rows = await getDb().execute<{ id: string; name: string; n: number; total: string; od_total: string; od_n: number; max_od: number | null; oldest: string | null }>(sql`
    SELECT c.id, c.name, count(*)::int AS n, sum(l.remaining)::text AS total,
           coalesce(sum(l.remaining) FILTER (WHERE l.due_on < ${today}::date), 0)::text AS od_total,
           count(*) FILTER (WHERE l.due_on < ${today}::date)::int AS od_n,
           max(${today}::date - l.due_on) FILTER (WHERE l.due_on < ${today}::date) AS max_od,
           min(l.issued_on)::text AS oldest
      FROM receivable_lines l JOIN customers c ON c.id = l.customer_id
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
    SELECT invoice_number AS inv, issued_on::text AS issued, due_on::text AS due, amount::text, paid::text, remaining::text AS rem, note
      FROM receivable_lines WHERE snapshot_id = ${last.id}::uuid AND customer_id = ${customerId}::uuid
     ORDER BY due_on NULLS LAST, issued_on NULLS LAST, row_number`);
  return { snapshot: last, lines: [...rows].map((r) => toLine(r, today)) };
}

/** Redovi koje nije bilo moguće povezati sa kupcem (vlasnik i kancelarija). */
export async function unmatchedDebtLines() {
  const last = await latestSnapshot();
  if (!last) return [];
  const rows = await getDb().execute<{ label: string; pib: string | null; code: string | null; n: number; total: string }>(sql`
    SELECT customer_label AS label, pib, partner_code AS code, count(*)::int AS n, sum(remaining)::text AS total
      FROM receivable_lines WHERE snapshot_id = ${last.id}::uuid AND customer_id IS NULL
     GROUP BY customer_label, pib, partner_code ORDER BY sum(remaining) DESC`);
  return [...rows].map((r) => ({ label: r.label, pib: r.pib, code: r.code, invoices: r.n, total: Number(r.total) }));
}
