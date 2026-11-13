"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { requireCapability, requireCustomerAccess, requireUser } from "@/lib/authz/session";
import { recordManualStockRequest, resolveStockRequests, StockRequestError } from "@/lib/stock/stock-requests";

export type TrazenoState = { ok: string | null; error: string | null };

const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim().replace(/\s/g, "").replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
};

/**
 * „Kupac tražio“ (0065): artikal po šifri iz BizniSofta (vodeće nule nisu bitne), kupac opciono.
 * Sa kartice kupca kupac je zadat i pristup mu se proverava na serveru.
 */
export async function recordStockRequestAction(_prev: TrazenoState, form: FormData): Promise<TrazenoState> {
  const user = await requireUser("/portal/nabavka");
  const code = String(form.get("sifra") ?? "").trim().slice(0, 40);
  const customerId = String(form.get("kupac") ?? "").trim() || null;
  const quantity = num(form.get("kolicina"));
  const note = String(form.get("napomena") ?? "");
  if (!code) return { ok: null, error: "Upišite šifru artikla." };
  if (Number.isNaN(quantity)) return { ok: null, error: "Količina nije broj." };
  if (customerId) {
    if (!/^[0-9a-f-]{36}$/i.test(customerId)) return { ok: null, error: "Neispravan kupac." };
    await requireCustomerAccess(user, customerId);
  }
  const key = code.replace(/^0+(?=\d)/, "");
  const [a] = [...(await getDb().execute<{ id: string; name: string }>(sql`
    SELECT id, name FROM articles WHERE regexp_replace(code, '^0+(?=[0-9])', '') = ${key} ORDER BY code LIMIT 1`))];
  if (!a) return { ok: null, error: `Artikal sa šifrom ${code} ne postoji u šifarniku.` };
  try {
    await recordManualStockRequest(user, { articleId: a.id, customerId, quantity, note });
  } catch (e) {
    if (e instanceof StockRequestError) return { ok: null, error: e.message };
    throw e;
  }
  revalidatePath("/portal/nabavka");
  if (customerId) revalidatePath(`/portal/kupci/${customerId}`);
  return { ok: `Zabeleženo: ${a.name}.`, error: null };
}

export async function resolveStockRequestsAction(_prev: TrazenoState, form: FormData): Promise<TrazenoState> {
  const user = await requireCapability("view:nabavka", "/portal/nabavka");
  const ids = form.getAll("id").map(String);
  const resolution = String(form.get("resenje") ?? "");
  if (!ids.length) return { ok: null, error: "Označite bar jedan red." };
  try {
    const r = await resolveStockRequests(user, { ids, resolution });
    revalidatePath("/portal/nabavka");
    return { ok: `Rešeno: ${r.resolved}.`, error: null };
  } catch (e) {
    if (e instanceof StockRequestError) return { ok: null, error: e.message };
    throw e;
  }
}
