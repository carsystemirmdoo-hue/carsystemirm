import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import type { PortalUser } from "@/lib/authz/session";
import { can } from "@/lib/authz/permissions.mjs";

/**
 * „Traženo — nema na stanju“ (0065; odluka vlasnika 2026-11-13: oba načina).
 *
 *  - automatski: stavka porudžbine kupca čiji artikal važeći potvrđen lager pokazuje sa 0 ili manje;
 *    artikal koga nema u izvozu lagera je „nepoznato“ i NE beleži se kao „nema“;
 *  - ručno: „Kupac tražio“ (komercijalista ili kancelarija), sa kupcem ili bez njega.
 *
 * Zapis se ne briše; „rešeno“ se upisuje jednom (poručeno, stiglo, ne poručujemo…).
 */

type Exec = { execute: ReturnType<typeof getDb>["execute"] };

export class StockRequestError extends Error {}

/** Pre migracije 0065 tabele nema: tada se ništa ne beleži (porudžbina ne sme da padne zbog ovoga). */
async function hasTable(exec: Exec) {
  const [r] = [...(await exec.execute<{ ok: boolean }>(sql`SELECT to_regclass('public.stock_requests') IS NOT NULL AS ok`))];
  return Boolean(r?.ok);
}

/** Važeći potvrđen lager: stanje šifre artikla (ključ bez vodećih nula), ili ništa ako šifre nema u izvozu. */
const CURRENT_STOCK = sql`
  (SELECT min(s.quantity) FROM stock_import_lines s
    WHERE s.import_id = (SELECT k.id FROM stock_imports k WHERE k.status = 'potvrdjeno' ORDER BY k.decided_at DESC LIMIT 1)
      AND s.code_key = regexp_replace(a.code, '^0+(?=[0-9])', ''))`;
const CURRENT_DATE_OF_STOCK = sql`(SELECT k.stock_date FROM stock_imports k WHERE k.status = 'potvrdjeno' ORDER BY k.decided_at DESC LIMIT 1)`;

/** U transakciji slanja porudžbine: beleži stavke čijeg artikla nema na lageru. Vraća broj zapisa. */
export async function recordOrderStockRequests(tx: Exec, orderId: string): Promise<number> {
  if (!(await hasTable(tx))) return 0;
  const rows = [...(await tx.execute<{ id: string }>(sql`
    INSERT INTO stock_requests (article_id, customer_id, quantity, source, order_id, stock_quantity, stock_date)
    SELECT x.article_id, x.customer_id, x.quantity, 'porudzbina', x.order_id, x.stock, x.stock_date
      FROM (
        SELECT l.article_id, o.customer_id, sum(l.quantity) AS quantity, o.id AS order_id,
               ${CURRENT_STOCK} AS stock, ${CURRENT_DATE_OF_STOCK} AS stock_date
          FROM customer_order_lines l
          JOIN customer_orders o ON o.id = l.order_id
          JOIN articles a ON a.id = l.article_id
         WHERE l.order_id = ${orderId}::uuid
         GROUP BY l.article_id, o.customer_id, o.id, a.code
      ) x
     WHERE x.stock IS NOT NULL AND x.stock <= 0
    ON CONFLICT (order_id, article_id) WHERE order_id IS NOT NULL DO NOTHING
    RETURNING id`))];
  return rows.length;
}

const CAN_RECORD = (user: PortalUser) => can(user, "view:preporuke") || can(user, "view:zahtevi") || can(user, "view:nabavka");

/** Ručno: „Kupac tražio“. `customerId` je opcion (telefonski upit bez kupca u bazi). */
export async function recordManualStockRequest(
  user: PortalUser,
  input: { articleId: string; customerId?: string | null; quantity?: number | null; note?: string | null },
) {
  if (!CAN_RECORD(user)) throw new StockRequestError("Nemate dozvolu za ovaj unos.");
  const db = getDb();
  if (!(await hasTable(db))) throw new StockRequestError("Evidencija još nije uključena na ovoj bazi.");
  const quantity = input.quantity === null || input.quantity === undefined ? null : Number(input.quantity);
  if (quantity !== null && !(quantity > 0 && quantity < 1e9)) throw new StockRequestError("Količina mora biti veća od nule.");
  const note = input.note?.trim().slice(0, 500) || null;
  return db.transaction(async (tx) => {
    const [a] = [...(await tx.execute<{ id: string; code: string; name: string; stock: string | null; stock_date: string | null }>(sql`
      SELECT a.id, a.code, a.name, ${CURRENT_STOCK}::text AS stock, ${CURRENT_DATE_OF_STOCK}::text AS stock_date
        FROM articles a WHERE a.id = ${input.articleId}::uuid`))];
    if (!a) throw new StockRequestError("Artikal ne postoji.");
    let customerName: string | null = null;
    if (input.customerId) {
      const [c] = [...(await tx.execute<{ name: string }>(sql`SELECT name FROM customers WHERE id = ${input.customerId}::uuid`))];
      if (!c) throw new StockRequestError("Kupac ne postoji.");
      customerName = c.name;
    }
    const [row] = [...(await tx.execute<{ id: string }>(sql`
      INSERT INTO stock_requests (article_id, customer_id, quantity, source, stock_quantity, stock_date, note, requested_by)
      VALUES (${a.id}::uuid, ${input.customerId ?? null}, ${quantity}, 'rucno', ${a.stock}, ${a.stock_date}, ${note}, ${user.id}::uuid)
      RETURNING id`))];
    await recordAudit(
      {
        actor: { id: user.id, name: user.name, role: user.role },
        action: AUDIT_ACTIONS.stockRequestRecorded,
        entityType: "Artikal",
        entityId: a.id,
        entityLabel: `${a.code} — ${a.name}`.slice(0, 200),
        after: { kupac: customerName, kolicina: quantity, lager: a.stock, napomena: note },
        reason: note,
      },
      tx as never,
    );
    return { id: row.id };
  });
}

export async function resolveStockRequests(user: PortalUser, input: { ids: string[]; resolution: string }) {
  if (!can(user, "view:nabavka")) throw new StockRequestError("Nemate dozvolu za ovaj unos.");
  const resolution = input.resolution.trim().slice(0, 200);
  if (resolution.length < 3) throw new StockRequestError("Upišite kako je rešeno (bar 3 znaka).");
  const ids = input.ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 500);
  if (!ids.length) return { resolved: 0 };
  const db = getDb();
  return db.transaction(async (tx) => {
    const rows = [...(await tx.execute<{ id: string }>(sql`
      UPDATE stock_requests SET resolved_at = now(), resolved_by = ${user.id}::uuid, resolution = ${resolution}
       WHERE resolved_at IS NULL AND id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})
      RETURNING id`))];
    if (rows.length) {
      await recordAudit(
        {
          actor: { id: user.id, name: user.name, role: user.role },
          action: AUDIT_ACTIONS.stockRequestResolved,
          entityType: "Traženo — nema na stanju",
          entityId: null,
          entityLabel: `${rows.length} zapisa`,
          after: { reseno: rows.length },
          reason: resolution,
        },
        tx as never,
      );
    }
    return { resolved: rows.length };
  });
}

export type StockRequestRow = {
  id: string;
  createdAt: string;
  source: "porudzbina" | "rucno";
  articleId: string;
  code: string;
  name: string;
  unit: string | null;
  quantity: number | null;
  customerName: string | null;
  orderNumber: string | null;
  stockQuantity: number | null;
  note: string | null;
  requestedBy: string | null;
};

/** Otvoreni zapisi (poslednjih 90 dana), najnoviji prvi. */
export async function listOpenStockRequests(limit = 300): Promise<StockRequestRow[]> {
  const db = getDb();
  if (!(await hasTable(db))) return [];
  const rows = await db.execute<{
    id: string; created_at: string; source: "porudzbina" | "rucno"; article_id: string; code: string; name: string; unit: string | null;
    quantity: string | null; customer_name: string | null; order_number: string | null; stock_quantity: string | null; note: string | null; requested_by: string | null;
  }>(sql`
    SELECT r.id, r.created_at::text, r.source, r.article_id, a.code, a.name, a.unit, r.quantity::text, c.name AS customer_name,
           coalesce(o.order_number, o.request_number) AS order_number, r.stock_quantity::text, r.note, u.name AS requested_by
      FROM stock_requests r
      JOIN articles a ON a.id = r.article_id
      LEFT JOIN customers c ON c.id = r.customer_id
      LEFT JOIN customer_orders o ON o.id = r.order_id
      LEFT JOIN users u ON u.id = r.requested_by
     WHERE r.resolved_at IS NULL AND r.created_at > now() - interval '90 days'
     ORDER BY r.created_at DESC
     LIMIT ${limit}`);
  return [...rows].map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    source: r.source,
    articleId: r.article_id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    quantity: r.quantity === null ? null : Number(r.quantity),
    customerName: r.customer_name,
    orderNumber: r.order_number,
    stockQuantity: r.stock_quantity === null ? null : Number(r.stock_quantity),
    note: r.note,
    requestedBy: r.requested_by,
  }));
}
