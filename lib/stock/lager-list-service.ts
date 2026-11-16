import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { canAccessCustomer } from "@/lib/authz/scope.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { customerPrices } from "@/lib/pricing/customer-price-service";
import { incomingByArticle } from "@/lib/procurement/incoming-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { internalStockQuantities } from "@/lib/stock/stock-import-service";

/**
 * Lager lista (2026-11-16): brz pregled artikla za komercijalistu — šifra, naziv, stanje,
 * pakovanje, VP cena i roba u dolasku, na jednom mestu.
 *
 * Stanje je izvorna količina iz važećeg (poslednjeg potvrđenog) snimka lagera, u JM artikla —
 * isti broj koji vidi Nabavka, bez kupčevog praga starosti. Datum snimka ekran prikazuje uz
 * napomenu o starosti. Artikal je na listi ako je u važećem snimku ili ima osnovnu cenu;
 * artikli van programa (3M, sia…) se ne prikazuju. Šifre iz snimka kojih još nema u šifarniku
 * portala (nova roba) idu na listu sa nazivom iz izvoza.
 */

export type LagerRow = {
  key: string;
  code: string;
  name: string;
  brand: string | null;
  group: string | null;
  unit: string | null;
  /** Količina u JM; null = nije u izvozu, sudar šifara, razlika JM ili prazna količina. */
  stock: number | null;
  /** Red postoji u važećem snimku (inače „nije u izvozu“). */
  inSnapshot: boolean;
  packLabel: string | null;
  packQuantity: number | null;
  /** Osnovna VP cena bez PDV-a (RSD) na današnji dan. */
  price: number | null;
  incoming: { quantity: number; nearest: string | null } | null;
  /** Šifra je u izvozu lagera, ali je nema u šifarniku portala. */
  newCode: boolean;
};

export type LagerList = { today: string; stockDate: string | null; rows: LagerRow[] };

export async function loadLagerList(now = new Date()): Promise<LagerList> {
  const today = belgradeDate(now);
  const db = getDb();
  const [stock, arts, incoming] = await Promise.all([
    internalStockQuantities(),
    db.execute<{ id: string; code: string; name: string; brand: string | null; grp: string | null; unit: string | null; price: string | null; pq: string | null; pl: string | null }>(sql`
      SELECT a.id, a.code, a.name, a.brand, a.product_group AS grp, a.unit,
             (SELECT b.net_price::text FROM article_base_prices b
               WHERE b.article_id = a.id AND b.valid_from <= ${today}::date
               ORDER BY b.valid_from DESC, b.created_at DESC LIMIT 1) AS price,
             ps.pack_quantity::text AS pq, ps.label AS pl
        FROM articles a
        LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id
       WHERE NOT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id)`),
    incomingByArticle().catch(() => new Map<string, { quantity: number; nearest: string | null }>()),
  ]);

  const rows: LagerRow[] = [];
  for (const a of arts) {
    const inSnapshot = stock.byArticle.has(a.id);
    if (!inSnapshot && a.price === null) continue;
    rows.push({
      key: a.id,
      code: a.code,
      name: a.name,
      brand: a.brand,
      group: a.grp,
      unit: a.unit,
      stock: inSnapshot ? (stock.byArticle.get(a.id) ?? null) : null,
      inSnapshot,
      packLabel: a.pl,
      packQuantity: a.pq === null ? null : Number(a.pq),
      price: a.price === null ? null : Number(a.price),
      incoming: incoming.get(a.id) ?? null,
      newCode: false,
    });
  }
  for (const u of stock.unlinked) {
    rows.push({
      key: `novo:${u.code}`,
      code: u.code,
      name: u.name,
      brand: null,
      group: null,
      unit: null,
      stock: u.quantity,
      inSnapshot: true,
      packLabel: null,
      packQuantity: null,
      price: null,
      incoming: null,
      newCode: true,
    });
  }
  rows.sort((x, y) => x.name.localeCompare(y.name, "sr-Latn", { sensitivity: "base", numeric: true }));
  return { today, stockDate: stock.snapshot?.stockDate ?? null, rows };
}

/* =========================================================================
 * Cena za kupca (2026-11-16): komercijalista bira kupca i vidi njegovu cenu
 * ====================================================================== */

export type LagerCustomer = { id: string; name: string; city: string | null; pib: string };

/** Kupci koje korisnik sme da vidi: komercijalista samo svoje (dodele), ostali sve aktivne. */
export async function lagerCustomers(viewer: PortalUser): Promise<LagerCustomer[]> {
  if (!can(viewer, "view:kupci")) return [];
  const all = seesAllCustomers(viewer);
  const ids = all ? [] : await loadAssignedCustomerIds(viewer.id);
  if (!all && !ids.length) return [];
  const rows = await getDb().execute<LagerCustomer>(sql`
    SELECT c.id, c.name, c.city, c.pib FROM customers c
     WHERE c.active ${all ? sql`` : sql`AND c.id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`}
     ORDER BY c.name`);
  return [...rows];
}

/** Šta tabela prikazuje u koloni „Cena za kupca“. */
export type LagerCustomerPrice =
  | { status: "cena"; netCents: number; discountPercent: number | null; fixed: boolean }
  | { status: "na_upit"; message: string }
  | { status: "van_ponude" };

/**
 * Cena izabranog kupca po artiklu, po osnovnom uslovu plaćanja — isto računanje kao kupčeva
 * cena na sajtu (`customerPrices`). Kupac van opsega korisnika daje `null` (kao da nije izabran).
 */
export async function lagerCustomerPrices(
  viewer: PortalUser,
  customerId: string,
  articleIds: string[],
  now = new Date(),
): Promise<{ customer: LagerCustomer; prices: Record<string, LagerCustomerPrice> } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(customerId)) return null;
  if (!can(viewer, "view:kupci")) return null;
  const assigned = seesAllCustomers(viewer) ? [] : await loadAssignedCustomerIds(viewer.id);
  if (!canAccessCustomer(viewer, assigned, customerId)) return null;
  const [customer] = [...(await getDb().execute<LagerCustomer>(sql`SELECT id, name, city, pib FROM customers WHERE id = ${customerId}::uuid`))];
  if (!customer) return null;
  const { prices } = await customerPrices(customerId, articleIds, belgradeDate(now));
  const out: Record<string, LagerCustomerPrice> = {};
  for (const [id, p] of prices) {
    out[id] =
      p.status === "cena"
        ? { status: "cena", netCents: p.netCents, discountPercent: p.discountPercent, fixed: p.discountPercent === null }
        : p.status === "na_upit"
          ? { status: "na_upit", message: p.message }
          : { status: "van_ponude" };
  }
  return { customer, prices: out };
}
