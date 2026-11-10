"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { AssignmentError, assignCustomer, listCustomerAssignees, removeAssignment } from "@/lib/partners/assignment-service";
import { importReceivablesFile, linkSheetLabel, ReceivablesError, refreshFromGoogle } from "@/lib/sales-tools/receivables-service";

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

/** Ručna veza naziva iz tabele sa kupcem (vlasnik i kancelarija — vide sve kupce). */
export async function linkSheetLabelAction(input: { key: string; customerId: string }): Promise<DebtActionResult> {
  const user = await requireCapability("view:dugovanja", "/portal/dugovanja");
  if (!seesAllCustomers(user)) return { ok: false, text: "Povezivanje rade vlasnik i kancelarija." };
  if (!/^[0-9a-f-]{36}$/i.test(String(input.customerId))) return { ok: false, text: "Izaberite kupca sa spiska." };
  try {
    await linkSheetLabel(user, { key: String(input.key ?? ""), customerId: String(input.customerId) });
  } catch (error) {
    if (error instanceof ReceivablesError) return { ok: false, text: error.message };
    throw error;
  }
  done();
  revalidatePath("/portal/preporuke");
  return { ok: true, text: "Povezano." };
}

/**
 * Dodela po tabeli: „Prebaci“ = kupac ostaje samo kod komercijaliste iz tabele; „Dodaj“ = i on.
 * Isti postupak i trag promena kao ručna dodela na kartici kupca.
 */
export async function assignFromSheetAction(input: { customerId: string; repId: string; mode: "prebaci" | "dodaj" }): Promise<DebtActionResult> {
  const user = await requireCapability("assignments:manage", "/portal/dugovanja");
  const ok = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
  if (!ok(String(input.customerId)) || !ok(String(input.repId))) return { ok: false, text: "Neispravan zahtev." };
  const actor = { id: user.id, name: user.name, role: user.role };
  const reason = "Po tabeli dugovanja kancelarije";
  try {
    await assignCustomer({ customerId: input.customerId, userId: input.repId, reason }, actor);
    if (input.mode === "prebaci") {
      for (const a of await listCustomerAssignees(input.customerId)) {
        if (a.userId !== input.repId) await removeAssignment({ customerId: input.customerId, userId: a.userId, reason }, actor);
      }
    }
  } catch (error) {
    if (error instanceof AssignmentError) return { ok: false, text: error.message };
    throw error;
  }
  done();
  revalidatePath(`/portal/kupci/${input.customerId}`);
  return { ok: true, text: input.mode === "prebaci" ? "Kupac je prebačen." : "Kupac je dodat." };
}
