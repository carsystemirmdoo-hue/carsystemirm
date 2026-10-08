import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { CustomerSession } from "@/lib/authz/customer-session";
import type { PortalUser } from "@/lib/authz/user-repository";
import { recordAudit } from "@/lib/audit/record";
import { getCarsystemProductBySlug, getProductVariantSelector } from "@/lib/carsystem-data";
import { resolveLedgerScope, type LedgerScope } from "@/lib/ledger/effective-sales";
import { parseQuantity, quantityProblem } from "@/lib/ordering/orderRules.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/**
 * „Zatraži cenu/uslove" — kupac traži cenu za proizvod bez cene, ili posebne
 * uslove (rabat) za proizvod koji ima samo cenovničku cenu.
 *
 * Zahtev ide u radnu listu kancelarije i komercijaliste: kancelarija vidi sve,
 * komercijalista samo dodeljene kupce. Ništa ovde ne menja cenu ni cenovnik —
 * odgovor je tekst; uslov se unosi u BizniSoft i stiže sa izvozom cenovnika.
 */

export const PRICE_REQUEST_STATUS_LABELS: Record<string, string> = {
  open: "Poslat",
  in_progress: "U obradi",
  answered: "Odgovoreno",
  closed: "Zatvoren",
};

export const PRICE_REQUEST_KIND_LABELS: Record<string, string> = {
  no_price: "Cena nije određena",
  special_terms: "Posebni uslovi / rabat",
};

export type PriceRequestResult =
  | { ok: true; id: string; requestNumber: string; existing: boolean }
  | { ok: false; message: string };

/** Šalje zahtev za cenu/uslove za firmu iz sesije. Isti ključ = isti zahtev. */
export async function createPriceRequest(
  session: CustomerSession,
  input: {
    slug: string;
    variantKey?: string | null;
    articleCode?: string | null;
    quantity: unknown;
    note?: string | null;
    kind: string;
    idempotencyKey: string;
  },
): Promise<PriceRequestResult> {
  const customerId = session.customerId;
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  const key = String(input.idempotencyKey ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(key)) return { ok: false, message: "Neispravan zahtev." };
  const kind = input.kind === "special_terms" ? "special_terms" : "no_price";

  const product = getCarsystemProductBySlug(String(input.slug ?? "").slice(0, 200));
  if (!product) return { ok: false, message: "Proizvod ne postoji u katalogu." };

  // Varijanta-red se čuva samo kada proizvod ima redove; tada mora biti tačna.
  const rows = (getProductVariantSelector(product)?.variants ?? []).filter((v) => !v.slug);
  let variantId: string | null = null;
  let variantLabel: string | null = null;
  if (rows.length > 1) {
    const wanted = String(input.variantKey ?? "").toLowerCase();
    const row = rows.find((v) => [v.sku, v.id].some((k) => k && k.toLowerCase() === wanted));
    if (!row) return { ok: false, message: "Izaberite tačnu varijantu proizvoda." };
    variantId = row.sku ?? row.id;
    variantLabel = row.label ?? variantId;
  }

  const qp = quantityProblem(input.quantity, { minQuantity: 0.001, quantityStep: 0.001 });
  if (qp) return { ok: false, message: qp };
  const quantity = parseQuantity(input.quantity);
  const note = input.note ? String(input.note).trim().slice(0, 1000) || null : null;

  const db = getDb();
  // Artikal samo ako je POTVRĐENO vezan baš za ovaj proizvod (i varijantu).
  let articleId: string | null = null;
  if (input.articleCode) {
    const [a] = [
      ...(await db.execute<{ id: string }>(sql`
        SELECT a.id FROM articles a JOIN article_catalog_mappings m ON m.article_id = a.id AND m.status = 'mapped'
         WHERE a.code = ${String(input.articleCode).slice(0, 60)} AND m.catalog_product_slug = ${product.slug}
           AND (m.catalog_variant_id IS NOT DISTINCT FROM ${variantId}) LIMIT 1`)),
    ];
    articleId = a?.id ?? null;
  }

  const existing = async () => {
    const [r] = [
      ...(await db.execute<{ id: string; customer_id: string; request_number: string }>(sql`
        SELECT id, customer_id, request_number FROM customer_price_requests WHERE idempotency_key = ${key}`)),
    ];
    if (!r) return null;
    if (r.customer_id !== customerId) return { ok: false as const, message: "Neispravan zahtev." };
    return { ok: true as const, id: r.id, requestNumber: r.request_number, existing: true };
  };
  const before = await existing();
  if (before) return before;

  try {
    const [{ n }] = [...(await db.execute<{ n: string }>(sql`SELECT nextval('customer_price_request_seq')::text AS n`))];
    const requestNumber = `U-${belgradeDate(new Date()).slice(0, 4)}-${String(n).padStart(5, "0")}`;
    const [row] = [
      ...(await db.execute<{ id: string }>(sql`
        INSERT INTO customer_price_requests (customer_id, requested_by, request_number, kind, idempotency_key,
          catalog_product_slug, catalog_variant_id, catalog_name, variant_label, article_id, quantity, customer_note)
        VALUES (${customerId}, ${session.accountId}, ${requestNumber}, ${kind}::price_request_kind, ${key},
          ${product.slug}, ${variantId}, ${product.name}, ${variantLabel}, ${articleId}::uuid, ${quantity}, ${note})
        RETURNING id`)),
    ];
    return { ok: true, id: row.id, requestNumber, existing: false };
  } catch (error) {
    const e = error as { code?: string; cause?: { code?: string } };
    if (e?.code === "23505" || e?.cause?.code === "23505") {
      const again = await existing();
      if (again) return again;
    }
    throw error;
  }
}

export type PriceRequestRow = {
  id: string;
  requestNumber: string;
  kind: string;
  status: string;
  customerId: string;
  customerName: string;
  requestedByName: string;
  slug: string;
  catalogName: string;
  variantLabel: string | null;
  articleCode: string | null;
  /** Naziv iz BizniSofta — samo za interni prikaz. */
  articleName: string | null;
  quantity: number;
  customerNote: string | null;
  answer: string | null;
  handledByName: string | null;
  createdAt: Date;
  answeredAt: Date | null;
  reps: string[];
};

function scopeWhere(scope: LedgerScope): SQL {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  return sql`r.customer_id IN (${sql.join(scope.customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`;
}

async function listRequests(where: SQL): Promise<PriceRequestRow[]> {
  const rows = await getDb().execute<{
    id: string; request_number: string; kind: string; status: string; customer_id: string; customer_name: string;
    requested_by_name: string; slug: string; catalog_name: string; variant_label: string | null; article_code: string | null; article_name: string | null;
    quantity: string; customer_note: string | null; answer: string | null; handled_by_name: string | null;
    created_at: Date; answered_at: Date | null; reps: string[] | null;
  }>(sql`
    SELECT r.id, r.request_number, r.kind::text AS kind, r.status::text AS status, r.customer_id, c.name AS customer_name,
           cu.name AS requested_by_name, r.catalog_product_slug AS slug, r.catalog_name, r.variant_label,
           a.code AS article_code, a.name AS article_name, r.quantity::text AS quantity, r.customer_note, r.answer, u.name AS handled_by_name,
           r.created_at, r.answered_at,
           (SELECT array_agg(ru.name ORDER BY ru.name) FROM customer_assignments ca JOIN users ru ON ru.id = ca.user_id
             WHERE ca.customer_id = r.customer_id) AS reps
      FROM customer_price_requests r
      JOIN customers c ON c.id = r.customer_id
      JOIN customer_users cu ON cu.id = r.requested_by
      LEFT JOIN articles a ON a.id = r.article_id
      LEFT JOIN users u ON u.id = r.handled_by
     WHERE ${where}
     ORDER BY r.created_at DESC
     LIMIT 300`);
  return [...rows].map((r) => ({
    id: r.id, requestNumber: r.request_number, kind: r.kind, status: r.status, customerId: r.customer_id,
    customerName: r.customer_name, requestedByName: r.requested_by_name, slug: r.slug, catalogName: r.catalog_name,
    variantLabel: r.variant_label, articleCode: r.article_code, articleName: r.article_name, quantity: Number(r.quantity), customerNote: r.customer_note,
    answer: r.answer, handledByName: r.handled_by_name, createdAt: new Date(r.created_at),
    answeredAt: r.answered_at ? new Date(r.answered_at) : null, reps: r.reps ?? [],
  }));
}

/** Zahtevi za cenu/uslove firme iz sesije. */
export async function listCustomerPriceRequests(customerId: string): Promise<PriceRequestRow[]> {
  if (!customerId) throw new Error("Upit kupca bez customer_id se ne sme izvršiti.");
  return listRequests(sql`r.customer_id = ${customerId}`);
}

/** Radna lista: kancelarija sve, komercijalista samo dodeljene kupce. */
export async function listPriceRequests(viewer: PortalUser): Promise<PriceRequestRow[]> {
  return listRequests(scopeWhere(await resolveLedgerScope(viewer)));
}

export type PriceRequestChange = { ok: true; changed: boolean } | { ok: false; message: string };

const ALLOWED: Record<string, string[]> = {
  in_progress: ["open"],
  answered: ["open", "in_progress"],
  closed: ["open", "in_progress", "answered"],
};

/** Preuzimanje, odgovor i zatvaranje. Opseg iz korisnika; isti prelaz dvaput = no-op. */
export async function changePriceRequest(
  viewer: PortalUser,
  id: string,
  to: "in_progress" | "answered" | "closed",
  answer?: string | null,
): Promise<PriceRequestChange> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Zahtev ne postoji." };
  const text = answer ? String(answer).trim().slice(0, 2000) : "";
  if (to === "answered" && text.length < 5) return { ok: false, message: "Odgovor kupcu je obavezan (najmanje 5 znakova)." };
  const scope = await resolveLedgerScope(viewer);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [r] = [
      ...(await tx.execute<{ id: string; status: string; request_number: string }>(sql`
        SELECT r.id, r.status::text AS status, r.request_number FROM customer_price_requests r
         WHERE r.id = ${id}::uuid AND ${scopeWhere(scope)} FOR UPDATE`)),
    ];
    if (!r) return { ok: false as const, message: "Zahtev ne postoji." };
    if (r.status === to) return { ok: true as const, changed: false };
    if (!ALLOWED[to]?.includes(r.status)) return { ok: false as const, message: "Ovaj korak nije dozvoljen u trenutnom stanju." };
    await tx.execute(sql`
      UPDATE customer_price_requests SET
        status = ${to}::price_request_status,
        handled_by = ${viewer.id},
        taken_at = COALESCE(taken_at, now()),
        answer = CASE WHEN ${to} = 'answered' THEN ${text} ELSE answer END,
        answered_at = CASE WHEN ${to} = 'answered' THEN now() ELSE answered_at END,
        closed_at = CASE WHEN ${to} = 'closed' THEN now() ELSE closed_at END,
        updated_at = now()
      WHERE id = ${r.id}`);
    await recordAudit(
      {
        actor: { id: viewer.id, name: viewer.name, role: viewer.role },
        action: `price_request.${to}`,
        entityType: "customer_price_request",
        entityId: r.id,
        entityLabel: r.request_number,
        before: { status: r.status },
        after: { status: to },
      },
      tx,
    );
    return { ok: true as const, changed: true };
  });
}
