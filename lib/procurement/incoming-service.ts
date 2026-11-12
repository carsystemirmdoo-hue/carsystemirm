import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import type { PortalUser } from "@/lib/authz/session";
import { readXlsxCells, XlsxReadError } from "@/lib/import/xlsx/readXlsx.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { CsvReadError, readCsvGrid } from "@/lib/stock/csvGrid.mjs";
import { internalStockQuantities } from "@/lib/stock/stock-import-service";
import { allocateArrivals, buildArticleIndex, countdown, leadFor, parseOrderSheet, rankArticles, SUPPLIERS } from "./incoming.mjs";
import { brandOf } from "./suggest.mjs";

/**
 * Roba u dolasku (0064; 2026-11-12, zahtev vlasnika).
 *
 * Porudžbina dobavljaču ulazi iz potvrde (Excel/CSV), ručno (npr. Carsystem šalje skeniran PDF) ili
 * iz fajla porudžbine na ekranu Nabavka. Stavka se zatvara sama kada potvrđen lager pokaže povećanje
 * stanja artikla posle porudžbine; vlasnik je može i ručno označiti.
 */

export const MAX_ORDER_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_ORDER_LINES = 1500;

export class IncomingError extends Error {}

type Actor = Pick<PortalUser, "id" | "name" | "role">;
const actorOf = (u: Actor) => ({ id: u.id, name: u.name, role: u.role });

/* =========================================================================
 * Čitanje potvrde
 * ====================================================================== */

export type SheetPreview = { rows: (string | number | null)[][]; sheet: string | null };

/** Prvi list sa prepoznatim zaglavljem; ako ga nema, prvi neprazan list (korisnik bira kolone). */
export function readOrderFile(bytes: Uint8Array): SheetPreview {
  const buf = Buffer.from(bytes);
  if (!buf.length) throw new IncomingError("Fajl je prazan.");
  if (buf.length > MAX_ORDER_FILE_BYTES) throw new IncomingError("Fajl je veći od 4 MB.");
  if (buf[0] === 0x25 && buf[1] === 0x50) throw new IncomingError("Ovo je PDF. Potvrdu u PDF-u (npr. skeniranu) unesite ručno — dugme „Ručni unos“.");
  try {
    if (buf[0] === 0x50 && buf[1] === 0x4b) {
      const sheets = readXlsxCells(buf).filter((s) => s.rows.some((r) => r.some((c) => c !== null && String(c).trim() !== "")));
      if (!sheets.length) throw new IncomingError("Tabela nema nijedan popunjen list.");
      const pick = sheets.find((s) => parseOrderSheet(s.rows).ok) ?? sheets[0];
      return { rows: pick.rows, sheet: pick.name };
    }
    return { rows: readCsvGrid(buf).rows as (string | null)[][], sheet: null };
  } catch (error) {
    if (error instanceof XlsxReadError || error instanceof CsvReadError) throw new IncomingError("Fajl nije čitljiv (očekuje se Excel XLSX ili CSV; stari .xls sačuvajte kao .xlsx).");
    throw error;
  }
}

export type ProposedLine = {
  row: number;
  supplierCode: string | null;
  supplierName: string;
  quantity: number;
  unit: string | null;
  /** Predlog: zapamćena veza, ista šifra kao naša ili kandidati po nazivu. */
  match: { id: string; code: string; name: string; unit: string | null; how: "zapamceno" | "sifra" | "naziv"; score: number } | null;
  candidates: { id: string; code: string; name: string; unit: string | null; score: number }[];
};

async function articlesFor(supplier: string) {
  const rows = await getDb().execute<{ id: string; code: string; name: string; unit: string | null; brand: string | null }>(sql`
    SELECT a.id, a.code, a.name, a.unit, a.brand FROM articles a
     WHERE NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)`);
  const all = [...rows];
  const own = supplier === "Ostalo" ? all : all.filter((a) => brandOf(a.name, a.brand) === supplier);
  return { all, own: own.length ? own : all };
}

/** Predlozi za pročitane stavke: zapamćeno → ista šifra (bilo koji brend) → naziv (brend dobavljača). */
export async function proposeLines(supplier: string, lines: Omit<ProposedLine, "match" | "candidates">[]): Promise<ProposedLine[]> {
  const db = getDb();
  const codes = [...new Set(lines.map((l) => l.supplierCode).filter((c): c is string => Boolean(c)))];
  const remembered = codes.length
    ? await db.execute<{ supplier_code: string; id: string; code: string; name: string; unit: string | null }>(sql`
        SELECT s.supplier_code, a.id, a.code, a.name, a.unit FROM supplier_article_codes s JOIN articles a ON a.id = s.article_id
         WHERE s.supplier = ${supplier} AND s.supplier_code IN (${sql.join(codes.map((c) => sql`${c}`), sql`, `)})`)
    : [];
  const rem = new Map([...remembered].map((r) => [r.supplier_code, r]));
  const { all, own } = await articlesFor(supplier);
  const anyIndex = buildArticleIndex(all);
  const ownIndex = buildArticleIndex(own);
  return lines.map((l) => {
    const r = l.supplierCode ? rem.get(l.supplierCode) : undefined;
    if (r) return { ...l, match: { id: r.id, code: r.code, name: r.name, unit: r.unit, how: "zapamceno" as const, score: 3 }, candidates: [] };
    const sameCode = l.supplierCode ? rankArticles({ supplierCode: l.supplierCode, supplierName: "" }, anyIndex).find((c) => c.how === "sifra") : undefined;
    if (sameCode) return { ...l, match: { ...sameCode, how: "sifra" as const }, candidates: [] };
    const ranked = rankArticles({ supplierCode: l.supplierCode, supplierName: l.supplierName }, ownIndex);
    const [a, b] = ranked;
    // Predlog se unapred bira samo kada je jasan; ostalo bira vlasnik između kandidata.
    const sure = a && a.score >= 0.75 && a.score - (b?.score ?? 0) >= 0.2;
    return { ...l, match: sure ? { id: a.id, code: a.code, name: a.name, unit: a.unit, how: "naziv" as const, score: a.score } : null, candidates: ranked.map(({ id, code, name, unit, score }) => ({ id, code, name, unit, score })) };
  });
}

/** Pretraga artikla za ručni unos i ručno povezivanje (šifra ili deo naziva). */
export async function searchArticles(q: string) {
  const t = q.trim();
  if (t.length < 2) return [];
  const like = `%${t.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const rows = await getDb().execute<{ id: string; code: string; name: string; unit: string | null }>(sql`
    SELECT a.id, a.code, a.name, a.unit FROM articles a
     WHERE (a.code ILIKE ${like} OR a.name ILIKE ${like})
       AND NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)
     ORDER BY (a.code = ${t}) DESC, a.name LIMIT 20`);
  return [...rows];
}

/* =========================================================================
 * Upis
 * ====================================================================== */

export type NewOrderInput = {
  supplier: string;
  reference: string | null;
  orderedOn: string;
  leadMin: number;
  leadMax: number;
  source: "excel" | "rucno" | "nabavka";
  fileName: string | null;
  note: string | null;
  lines: { supplierCode: string | null; supplierName: string; quantity: number; unit: string | null; articleId: string | null; remember: boolean }[];
};

export async function createSupplierOrder(actor: Actor, input: NewOrderInput) {
  if (!SUPPLIERS.includes(input.supplier)) throw new IncomingError("Nepoznat dobavljač.");
  if (!input.lines.length) throw new IncomingError("Porudžbina nema nijednu stavku.");
  if (input.lines.length > MAX_ORDER_LINES) throw new IncomingError(`Najviše ${MAX_ORDER_LINES} stavki po porudžbini.`);
  if (!(input.leadMin >= 0 && input.leadMax >= input.leadMin && input.leadMax <= 365)) throw new IncomingError("Rok isporuke nije ispravan.");
  const stock = await internalStockQuantities();
  const db = getDb();
  return db.transaction(async (tx) => {
    const ids = [...new Set(input.lines.map((l) => l.articleId).filter((x): x is string => Boolean(x)))];
    if (ids.length) {
      const found = await tx.execute<{ id: string }>(sql`SELECT id FROM articles WHERE id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
      if ([...found].length !== ids.length) throw new IncomingError("Neki izabrani artikal više ne postoji. Osvežite stranu.");
    }
    const [order] = [...(await tx.execute<{ id: string }>(sql`
      INSERT INTO supplier_orders (supplier, reference, ordered_on, lead_min_days, lead_max_days, source, file_name, note, created_by)
      VALUES (${input.supplier}, ${input.reference}, ${input.orderedOn}::date, ${input.leadMin}, ${input.leadMax}, ${input.source},
              ${input.fileName}, ${input.note}, ${actor.id}::uuid)
      RETURNING id`))];
    let no = 0;
    let remembered = 0;
    for (const l of input.lines) {
      no += 1;
      // Stanje u trenutku unosa: iz njega se kasnije meri povećanje (prijem). Nema u izvozu = 0.
      const base = l.articleId ? (stock.byArticle.get(l.articleId) ?? 0) : null;
      await tx.execute(sql`
        INSERT INTO supplier_order_lines (order_id, line_no, supplier_code, supplier_name, article_id, quantity, unit, baseline_stock, last_seen_stock, last_checked_import_id)
        VALUES (${order.id}::uuid, ${no}, ${l.supplierCode}, ${l.supplierName.slice(0, 200)}, ${l.articleId}::uuid, ${l.quantity}, ${l.unit},
                ${base}, ${base}, ${stock.snapshot?.id ?? null}::uuid)`);
      if (l.remember && l.articleId && l.supplierCode) {
        await tx.execute(sql`
          INSERT INTO supplier_article_codes (supplier, supplier_code, article_id, confirmed_by)
          VALUES (${input.supplier}, ${l.supplierCode}, ${l.articleId}::uuid, ${actor.id}::uuid)
          ON CONFLICT (supplier, supplier_code) DO UPDATE SET article_id = EXCLUDED.article_id, confirmed_by = EXCLUDED.confirmed_by, confirmed_at = now()`);
        remembered += 1;
      }
    }
    await recordAudit(
      {
        actor: actorOf(actor),
        action: AUDIT_ACTIONS.supplierOrderCreated,
        entityType: "Porudžbina dobavljaču",
        entityId: order.id,
        entityLabel: `${input.supplier}${input.reference ? ` — ${input.reference}` : ""}`,
        after: { stavki: input.lines.length, nepovezano: input.lines.filter((l) => !l.articleId).length, zapamceno: remembered, rok: `${input.leadMin}–${input.leadMax}`, izvor: input.source },
        reason: input.note,
      },
      tx,
    );
    return { id: order.id, lines: input.lines.length, remembered };
  });
}

/* =========================================================================
 * Prijem iz lagera
 * ====================================================================== */

/**
 * Stavke koje čekaju porede se sa važećim potvrđenim lagerom. Svaki snimak se obrađuje jednom po
 * stavci (`last_checked_import_id`), pa je poziv bezopasan i pri svakom otvaranju ekrana.
 */
export async function settleArrivals(): Promise<{ checked: number; arrived: number }> {
  const stock = await internalStockQuantities();
  const snap = stock.snapshot;
  if (!snap) return { checked: 0, arrived: 0 };
  const db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('supplier_order_arrivals'))`);
    type OpenRow = { id: string; order_id: string; article_id: string; quantity: string; received: string; last_seen_stock: string | null };
    const open = await tx.execute<OpenRow>(sql`
      SELECT l.id, l.order_id, l.article_id, l.quantity::text, l.received::text, l.last_seen_stock::text
        FROM supplier_order_lines l JOIN supplier_orders o ON o.id = l.order_id
       WHERE l.status = 'ceka' AND o.status = 'otvoreno' AND l.article_id IS NOT NULL
         AND l.last_checked_import_id IS DISTINCT FROM ${snap.id}::uuid
       ORDER BY o.ordered_on, o.created_at, l.line_no
       FOR UPDATE OF l`);
    let arrived = 0;
    const touched = new Set<string>();
    const byArticle = new Map<string, OpenRow[]>();
    for (const l of open) byArticle.set(l.article_id, [...(byArticle.get(l.article_id) ?? []), l]);
    for (const [articleId, group] of byArticle) {
      const now = stock.byArticle.get(articleId) ?? null;
      const result = allocateArrivals(
        group.map((l) => ({ id: l.id, quantity: Number(l.quantity), received: Number(l.received), lastSeen: l.last_seen_stock === null ? null : Number(l.last_seen_stock) })),
        now,
      );
      for (const [i, r] of result.entries()) {
        await tx.execute(sql`
          UPDATE supplier_order_lines
             SET received = ${r.received}, last_seen_stock = ${now ?? 0}, last_checked_import_id = ${snap.id}::uuid,
                 status = ${r.arrived ? "stiglo" : "ceka"}, arrived_at = ${r.arrived ? sql`now()` : sql`NULL`}
           WHERE id = ${r.id}::uuid`);
        if (r.arrived) {
          arrived += 1;
          touched.add(group[i].order_id);
        }
      }
    }
    for (const id of touched) await closeIfDone(tx, id, null);
    return { checked: [...open].length, arrived };
  });
}

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

async function closeIfDone(tx: Tx, orderId: string, actorId: string | null) {
  await tx.execute(sql`
    UPDATE supplier_orders SET status = 'zatvoreno', closed_at = now(), closed_by = ${actorId}::uuid
     WHERE id = ${orderId}::uuid AND status = 'otvoreno'
       AND NOT EXISTS (SELECT 1 FROM supplier_order_lines l WHERE l.order_id = ${orderId}::uuid AND l.status = 'ceka')`);
}

/* =========================================================================
 * Ručne odluke
 * ====================================================================== */

export async function changeLine(actor: Actor, input: { lineId: string; action: "stiglo" | "otkazano" | "vrati" | "povezi"; articleId?: string | null }) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [l] = [...(await tx.execute<{ id: string; order_id: string; status: string; supplier: string; supplier_code: string | null; quantity: string }>(sql`
      SELECT l.id, l.order_id, l.status, o.supplier, l.supplier_code, l.quantity::text
        FROM supplier_order_lines l JOIN supplier_orders o ON o.id = l.order_id WHERE l.id = ${input.lineId}::uuid FOR UPDATE OF l`))];
    if (!l) throw new IncomingError("Stavka ne postoji.");
    if (input.action === "povezi") {
      if (!input.articleId) throw new IncomingError("Izaberite artikal.");
      const stock = await internalStockQuantities();
      const base = stock.byArticle.get(input.articleId) ?? 0;
      await tx.execute(sql`
        UPDATE supplier_order_lines SET article_id = ${input.articleId}::uuid, baseline_stock = ${base}, last_seen_stock = ${base},
               last_checked_import_id = ${stock.snapshot?.id ?? null}::uuid
         WHERE id = ${l.id}::uuid`);
      if (l.supplier_code) {
        await tx.execute(sql`
          INSERT INTO supplier_article_codes (supplier, supplier_code, article_id, confirmed_by)
          VALUES (${l.supplier}, ${l.supplier_code}, ${input.articleId}::uuid, ${actor.id}::uuid)
          ON CONFLICT (supplier, supplier_code) DO UPDATE SET article_id = EXCLUDED.article_id, confirmed_by = EXCLUDED.confirmed_by, confirmed_at = now()`);
      }
    } else if (input.action === "vrati") {
      await tx.execute(sql`UPDATE supplier_order_lines SET status = 'ceka', arrived_at = NULL, closed_by = NULL WHERE id = ${l.id}::uuid`);
      await tx.execute(sql`UPDATE supplier_orders SET status = 'otvoreno', closed_at = NULL, closed_by = NULL WHERE id = ${l.order_id}::uuid AND status = 'zatvoreno'`);
    } else {
      if (l.status !== "ceka") throw new IncomingError("O ovoj stavci je već odlučeno.");
      await tx.execute(sql`
        UPDATE supplier_order_lines
           SET status = ${input.action}, closed_by = ${actor.id}::uuid, arrived_at = ${input.action === "stiglo" ? sql`now()` : sql`NULL`},
               received = ${input.action === "stiglo" ? sql`quantity` : sql`received`}
         WHERE id = ${l.id}::uuid`);
      await closeIfDone(tx, l.order_id, actor.id);
    }
    await recordAudit(
      { actor: actorOf(actor), action: AUDIT_ACTIONS.supplierOrderLineChanged, entityType: "Porudžbina dobavljaču", entityId: l.order_id, entityLabel: l.supplier, after: { stavka: l.id, akcija: input.action }, reason: null },
      tx,
    );
  });
}

export async function closeOrder(actor: Actor, input: { orderId: string; action: "otkazano" | "zatvoreno" }) {
  const db = getDb();
  await db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; supplier: string }>(sql`
      UPDATE supplier_orders SET status = ${input.action}, closed_at = now(), closed_by = ${actor.id}::uuid
       WHERE id = ${input.orderId}::uuid AND status = 'otvoreno' RETURNING id, supplier`);
    const o = [...rows][0];
    if (!o) throw new IncomingError("Porudžbina je već zatvorena.");
    await tx.execute(sql`
      UPDATE supplier_order_lines SET status = ${input.action === "otkazano" ? "otkazano" : "stiglo"}, closed_by = ${actor.id}::uuid,
             arrived_at = ${input.action === "zatvoreno" ? sql`coalesce(arrived_at, now())` : sql`arrived_at`}
       WHERE order_id = ${o.id}::uuid AND status = 'ceka'`);
    await recordAudit(
      { actor: actorOf(actor), action: AUDIT_ACTIONS.supplierOrderClosed, entityType: "Porudžbina dobavljaču", entityId: o.id, entityLabel: o.supplier, after: { status: input.action }, reason: null },
      tx,
    );
  });
}

/* =========================================================================
 * Prikaz
 * ====================================================================== */

export type IncomingLine = {
  id: string;
  lineNo: number;
  supplierCode: string | null;
  supplierName: string;
  articleId: string | null;
  articleCode: string | null;
  articleName: string | null;
  quantity: number;
  unit: string | null;
  received: number;
  status: "ceka" | "stiglo" | "otkazano";
  arrivedAt: string | null;
  stockNow: number | null;
};

export type IncomingOrder = {
  id: string;
  supplier: string;
  reference: string | null;
  orderedOn: string;
  leadMin: number;
  leadMax: number;
  source: string;
  fileName: string | null;
  note: string | null;
  status: "otvoreno" | "zatvoreno" | "otkazano";
  closedAt: string | null;
  createdBy: string;
  countdown: ReturnType<typeof countdown>;
  lines: IncomingLine[];
};

export async function loadIncoming(opts: { now?: Date; closedDays?: number } = {}) {
  const today = belgradeDate(opts.now ?? new Date());
  const db = getDb();
  const [orders, lines, stock] = await Promise.all([
    db.execute<{
      id: string; supplier: string; reference: string | null; ordered_on: string; lead_min_days: number; lead_max_days: number;
      source: string; file_name: string | null; note: string | null; status: IncomingOrder["status"]; closed_at: string | null; created_by: string;
    }>(sql`
      SELECT o.id, o.supplier, o.reference, o.ordered_on::text, o.lead_min_days, o.lead_max_days, o.source, o.file_name, o.note,
             o.status, o.closed_at::text, coalesce(u.name, '—') AS created_by
        FROM supplier_orders o LEFT JOIN users u ON u.id = o.created_by
       WHERE o.status = 'otvoreno' OR o.closed_at > now() - make_interval(days => ${opts.closedDays ?? 30})
       ORDER BY (o.status = 'otvoreno') DESC, o.ordered_on DESC, o.created_at DESC`),
    db.execute<{
      id: string; order_id: string; line_no: number; supplier_code: string | null; supplier_name: string; article_id: string | null;
      code: string | null; name: string | null; quantity: string; unit: string | null; received: string; status: IncomingLine["status"]; arrived_at: string | null;
    }>(sql`
      SELECT l.id, l.order_id, l.line_no, l.supplier_code, l.supplier_name, l.article_id, a.code, a.name, l.quantity::text,
             coalesce(l.unit, a.unit) AS unit, l.received::text, l.status, l.arrived_at::text
        FROM supplier_order_lines l
        JOIN supplier_orders o ON o.id = l.order_id
        LEFT JOIN articles a ON a.id = l.article_id
       WHERE o.status = 'otvoreno' OR o.closed_at > now() - make_interval(days => ${opts.closedDays ?? 30})
       ORDER BY l.order_id, l.line_no`),
    internalStockQuantities(),
  ]);
  const byOrder = new Map<string, IncomingLine[]>();
  for (const l of lines) {
    const list = byOrder.get(l.order_id) ?? [];
    list.push({
      id: l.id,
      lineNo: l.line_no,
      supplierCode: l.supplier_code,
      supplierName: l.supplier_name,
      articleId: l.article_id,
      articleCode: l.code,
      articleName: l.name,
      quantity: Number(l.quantity),
      unit: l.unit,
      received: Number(l.received),
      status: l.status,
      arrivedAt: l.arrived_at,
      stockNow: l.article_id ? (stock.byArticle.get(l.article_id) ?? null) : null,
    });
    byOrder.set(l.order_id, list);
  }
  const out: IncomingOrder[] = [...orders].map((o) => ({
    id: o.id,
    supplier: o.supplier,
    reference: o.reference,
    orderedOn: o.ordered_on,
    leadMin: o.lead_min_days,
    leadMax: o.lead_max_days,
    source: o.source,
    fileName: o.file_name,
    note: o.note,
    status: o.status,
    closedAt: o.closed_at,
    createdBy: o.created_by,
    countdown: countdown(o.ordered_on, o.lead_min_days, o.lead_max_days, today),
    lines: byOrder.get(o.id) ?? [],
  }));
  return { today, stockDate: stock.snapshot?.stockDate ?? null, orders: out, leadFor };
}

/** Količina u dolasku po artiklu (otvorene porudžbine, stavke koje čekaju) — za ekran Nabavka. */
export async function incomingByArticle(): Promise<Map<string, { quantity: number; nearest: string | null }>> {
  const rows = await getDb().execute<{ article_id: string; qty: string; nearest: string | null }>(sql`
    SELECT l.article_id, sum(l.quantity - l.received)::text AS qty,
           min(o.ordered_on + o.lead_max_days)::text AS nearest
      FROM supplier_order_lines l JOIN supplier_orders o ON o.id = l.order_id
     WHERE o.status = 'otvoreno' AND l.status = 'ceka' AND l.article_id IS NOT NULL
     GROUP BY l.article_id`);
  return new Map([...rows].map((r) => [r.article_id, { quantity: Number(r.qty), nearest: r.nearest }]));
}
