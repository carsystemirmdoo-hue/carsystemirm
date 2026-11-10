"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { importReceivablesFile, ReceivablesError, refreshFromGoogle } from "@/lib/sales-tools/receivables-service";

export type DebtActionResult = { ok: boolean; text: string } | null;

const describe = (r: { changed: boolean; lines: number; warnings: number }) =>
  `${r.changed ? "Učitano novo stanje" : "Stanje je isto kao pre"}: ${r.lines} otvorenih faktura${r.warnings ? `, ${r.warnings} redova za proveru` : ""}.`;

function done() {
  revalidatePath("/portal/dugovanja");
  revalidatePath("/portal");
}

/** „Osveži sada“: čitanje Google tabele (svako ko vidi dugovanja; samo čitanje izvora). */
export async function refreshDebtsAction(): Promise<DebtActionResult> {
  const user = await requireCapability("view:dugovanja", "/portal/dugovanja");
  try {
    const r = await refreshFromGoogle(user.id);
    done();
    return { ok: true, text: describe(r) };
  } catch (error) {
    if (error instanceof ReceivablesError) return { ok: false, text: error.message };
    throw error;
  }
}

/** Rezerva: kancelarija otprema tabelu (XLSX ili CSV). */
export async function uploadDebtsAction(_prev: DebtActionResult, form: FormData): Promise<DebtActionResult> {
  const user = await requireCapability("imports:write", "/portal/dugovanja");
  const file = form.get("fajl");
  if (!(file instanceof File) || file.size === 0) return { ok: false, text: "Izaberite fajl (XLSX ili CSV)." };
  try {
    const r = await importReceivablesFile(user, file.name, new Uint8Array(await file.arrayBuffer()));
    done();
    return { ok: true, text: describe(r) };
  } catch (error) {
    if (error instanceof ReceivablesError) return { ok: false, text: error.message };
    throw error;
  }
}
