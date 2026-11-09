"use server";

import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { PricingScopeError } from "@/lib/pricing/pricing-scope";
import { RebateChangeError } from "@/lib/pricing/rebate-change-service";
import { applyRebateTable, type RebateTableEdits } from "@/lib/pricing/rebate-table-service";
import { ARTIKAL, countOf } from "@/lib/ordering/plural.mjs";
import { parsePercent } from "@/lib/pricing/rebateTable.mjs";
import { PricingRuleError, WorkflowError } from "@/lib/pricing/rule-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Ulaz iz pregledača se čisti: samo poznati oblici, ograničene dužine. */
function percents(input: unknown, keyOk: (k: string) => boolean): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 3000)) {
    const p = parsePercent(v);
    if (keyOk(k) && p !== null) out[k] = p;
  }
  return out;
}

function cents(input: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>).slice(0, 3000)) {
    const n = Number(v);
    if (UUID.test(k) && Number.isInteger(n) && n > 0 && n < 1e12) out[k] = n;
  }
  return out;
}

export async function applyRebateTableAction(input: {
  customerId: string;
  edits: RebateTableEdits;
  effectiveFrom: string;
  reason: string;
  approveNow: boolean;
  expected: Record<string, string | null>;
}) {
  const customerId = String(input.customerId);
  if (!UUID.test(customerId)) return { ok: false as const, error: "Neispravan kupac." };
  const user = await requireCapability("prices:propose", `/portal/cene/rabati-iz-faktura/kupci/${customerId}/tabela`);
  const label = (k: string) => k.length > 0 && k.length <= 80;
  const expected: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(input.expected ?? {}).slice(0, 3000)) {
    if (UUID.test(k)) expected[k] = typeof v === "string" && UUID.test(v) ? v : null;
  }
  try {
    const r = await applyRebateTable(user, {
      customerId,
      edits: {
        brands: percents(input.edits?.brands, label),
        groups: percents(input.edits?.groups, label),
        articles: percents(input.edits?.articles, (k) => UUID.test(k)),
        nets: cents(input.edits?.nets),
        includeOwn: Boolean(input.edits?.includeOwn),
      },
      effectiveFrom: String(input.effectiveFrom ?? ""),
      reason: String(input.reason ?? ""),
      approveNow: Boolean(input.approveNow),
      expected,
    });
    revalidatePath(`/portal/cene/rabati-iz-faktura/kupci/${customerId}/tabela`);
    revalidatePath(`/portal/cene/rabati-iz-faktura/kupci/${customerId}`);
    const n = countOf(r.count, ARTIKAL);
    return {
      ok: true as const,
      message: r.approved
        ? `Odobreno: ${n}. Vlasnik promenu vidi u dnevnom zbiru i na „Promene komercijalista“.`
        : `Poslato na odobrenje: ${n}. Rabat se ne menja dok predlog ne bude odobren.`,
    };
  } catch (error) {
    if (error instanceof RebateChangeError || error instanceof WorkflowError || error instanceof PricingRuleError || error instanceof PricingScopeError) {
      return { ok: false as const, error: error.message };
    }
    throw error;
  }
}
