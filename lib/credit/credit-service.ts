import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { customerCreditLimits } from "@/db/schema/sales-tools";
import { systemSettings } from "@/db/schema/system";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { effectiveInvoiceCondition } from "@/lib/ledger/effective-invoice";
import { notify } from "@/lib/notifications/notification-service";
import { listAssigneesByCustomer } from "@/lib/partners/assignment-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { debtsByCustomer, debtsForAllCustomers, latestSnapshot, type CustomerDebt } from "@/lib/sales-tools/receivables-service";
import { CREDIT_PERCENT_SETTING, creditLimitFor, creditStatus, LATE_DAYS, normalizeDefaultPercent, parseLimitInput } from "./creditLimit.mjs";

/**
 * Kreditni limiti (0063; 2026-11-11). Dug je današnje stanje iz tabele kancelarije, kupovina
 * je zbir faktura sa PDV-om u poslednjih 365 dana (isti uslov prometa kao ekrani prodaje).
 */

export type CreditRow = {
  customerId: string;
  customerName: string;
  reps: string[];
  avgMonthly: number;
  debt: number;
  overdue: number;
  maxDaysOverdue: number | null;
  limit: number | null;
  basis: "default" | "percent" | "amount" | "none";
  percent: number | null;
  usage: number | null;
  status: "over" | "near" | "ok" | "no_limit";
  late: boolean;
  override: { percent: number | null; amount: number | null; blockOrders: boolean; note: string; setBy: string; setAt: string } | null;
};

export class CreditError extends Error {}

export async function defaultCreditPercent(): Promise<number> {
  const [row] = await getDb().select({ value: systemSettings.value }).from(systemSettings).where(eq(systemSettings.key, CREDIT_PERCENT_SETTING)).limit(1);
  return normalizeDefaultPercent(row?.value);
}

async function grossLast12Months(customerIds: string[] | null, today: string) {
  if (customerIds !== null && customerIds.length === 0) return new Map<string, number>();
  const rows = await getDb().execute<{ customer_id: string; gross: string }>(sql`
    SELECT invoices.customer_id, sum(invoices.total_amount)::text AS gross
      FROM invoices
     WHERE invoices.issued_on > ${today}::date - 365 AND invoices.issued_on <= ${today}::date
       AND ${effectiveInvoiceCondition()}
       ${customerIds === null ? sql`` : sql`AND invoices.customer_id IN (${sql.join(customerIds.map((id) => sql`${id}::uuid`), sql`, `)})`}
     GROUP BY invoices.customer_id`);
  return new Map([...rows].map((r) => [r.customer_id, Number(r.gross)]));
}

async function overrides(customerIds: string[] | null) {
  const rows = await getDb().execute<{ customer_id: string; percent: string | null; amount: string | null; block_orders: boolean; note: string; set_by: string; set_at: string }>(sql`
    SELECT l.customer_id, l.percent::text, l.amount::text, l.block_orders, l.note, u.name AS set_by, l.set_at::text
      FROM customer_credit_limits l JOIN users u ON u.id = l.set_by
     ${customerIds === null ? sql`` : customerIds.length ? sql`WHERE l.customer_id IN (${sql.join(customerIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql`WHERE false`}`);
  return new Map(
    [...rows].map((r) => [
      r.customer_id,
      { percent: r.percent === null ? null : Number(r.percent), amount: r.amount === null ? null : Number(r.amount), blockOrders: r.block_orders, note: r.note, setBy: r.set_by, setAt: r.set_at },
    ]),
  );
}

function buildRows(
  ids: Set<string>,
  names: Map<string, string>,
  gross: Map<string, number>,
  debts: Map<string, CustomerDebt>,
  ov: Awaited<ReturnType<typeof overrides>>,
  defaultPercent: number,
  reps: Map<string, { name: string }[]>,
): CreditRow[] {
  return [...ids].map((id) => {
    const o = ov.get(id) ?? null;
    const d = debts.get(id);
    const lim = creditLimitFor({ gross12m: gross.get(id) ?? 0, override: o, defaultPercent });
    const st = creditStatus({ debt: d?.total ?? 0, limit: lim.limit, maxDaysOverdue: d?.maxDaysOverdue ?? null });
    return {
      customerId: id,
      customerName: names.get(id) ?? d?.customerName ?? "—",
      reps: (reps.get(id) ?? []).map((r) => r.name),
      avgMonthly: lim.avgMonthly,
      debt: d?.total ?? 0,
      overdue: d?.overdueTotal ?? 0,
      maxDaysOverdue: d?.maxDaysOverdue ?? null,
      limit: lim.limit,
      basis: lim.basis,
      percent: lim.percent,
      usage: st.usage,
      status: st.status,
      late: st.late,
      override: o,
    };
  });
}

async function namesOf(ids: string[]) {
  if (!ids.length) return new Map<string, string>();
  const rows = await getDb().execute<{ id: string; name: string }>(sql`
    SELECT id, name FROM customers WHERE id IN (${sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `)})`);
  return new Map([...rows].map((r) => [r.id, r.name]));
}

/** Pregled za ekran: kupci u opsegu korisnika koji imaju kupovinu u 12 meseci, dug ili upisan limit. */
export async function loadCreditOverview(user: PortalUser) {
  const today = belgradeDate(new Date());
  const scope = await resolveLedgerScope(user);
  const [gross, debtRows, ov, defaultPercent, snap] = await Promise.all([
    grossLast12Months(scope.customerIds, today),
    debtsByCustomer(user, today),
    overrides(scope.customerIds),
    defaultCreditPercent(),
    latestSnapshot(),
  ]);
  const debts = new Map(debtRows.map((d) => [d.customerId, d]));
  const ids = new Set([...gross.keys(), ...debts.keys(), ...ov.keys()]);
  const [names, reps] = await Promise.all([namesOf([...ids]), listAssigneesByCustomer([...ids])]);
  const rows = buildRows(ids, names, gross, debts, ov, defaultPercent, reps);
  return { rows, defaultPercent, debtCheckedAt: snap?.checkedAt ?? null, today };
}

/** Sme li korisnik da menja limit ovog kupca: vlasnik (limits:approve) svima, komercijalista svojim. */
export async function canEditCreditLimit(user: PortalUser, customerId: string) {
  if (can(user, "limits:approve")) return true;
  if (user.role !== "komercijalista") return false;
  const scope = await resolveLedgerScope(user);
  return scope.customerIds === null || scope.customerIds.includes(customerId);
}

export async function setCreditLimit(user: PortalUser, input: { customerId: string; mode: string; value: string; blockOrders: boolean; note: string }) {
  if (!(await canEditCreditLimit(user, input.customerId))) throw new CreditError("Nemate dozvolu da menjate limit ovog kupca.");
  const parsed = parseLimitInput({ mode: input.mode, value: input.value });
  if (!parsed.ok) throw new CreditError(parsed.error);
  const note = input.note.trim();
  if (!parsed.reset && !note) throw new CreditError("Upišite kratko obrazloženje.");
  if (note.length > 500) throw new CreditError("Obrazloženje je predugačko (najviše 500 znakova).");
  const db = getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(customerCreditLimits).where(eq(customerCreditLimits.customerId, input.customerId)).limit(1);
    if (parsed.reset && !input.blockOrders) {
      await tx.delete(customerCreditLimits).where(eq(customerCreditLimits.customerId, input.customerId));
    } else {
      const values = {
        customerId: input.customerId,
        percent: parsed.percent === null ? null : String(parsed.percent),
        amount: parsed.amount === null ? null : String(parsed.amount),
        blockOrders: input.blockOrders,
        note: note || "Podrazumevani limit, uključena blokada",
        setBy: user.id,
        setAt: new Date(),
      };
      await tx.insert(customerCreditLimits).values(values).onConflictDoUpdate({ target: customerCreditLimits.customerId, set: values });
    }
    await recordAudit(
      {
        actor: { id: user.id, name: user.name, role: user.role },
        action: AUDIT_ACTIONS.dataCorrection,
        entityType: "Kreditni limit",
        entityId: input.customerId,
        before: before ? { procenat: before.percent, iznos: before.amount, blokada: before.blockOrders } : { limit: "podrazumevani" },
        after: parsed.reset && !input.blockOrders ? { limit: "podrazumevani" } : { procenat: parsed.percent, iznos: parsed.amount, blokada: input.blockOrders },
        reason: note || "Vraćen podrazumevani limit",
      },
      tx,
    );
  });
  await evaluateCreditWarnings(user.id);
}

export async function setDefaultCreditPercent(user: PortalUser, value: string) {
  if (!can(user, "limits:approve")) throw new CreditError("Podrazumevani procenat menja vlasnik.");
  const parsed = parseLimitInput({ mode: "percent", value });
  if (!parsed.ok || parsed.percent === null || parsed.percent <= 0) throw new CreditError(parsed.ok ? "Procenat mora biti veći od nule." : parsed.error);
  const percent = parsed.percent;
  const before = await defaultCreditPercent();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .insert(systemSettings)
      .values({ key: CREDIT_PERCENT_SETTING, value: { percent }, updatedBy: user.id })
      .onConflictDoUpdate({ target: systemSettings.key, set: { value: { percent }, updatedBy: user.id, updatedAt: new Date() } });
    await recordAudit(
      { actor: { id: user.id, name: user.name, role: user.role }, action: AUDIT_ACTIONS.settingChanged, entityType: "Kreditni limit — podrazumevani procenat", before: { procenat: before }, after: { procenat: percent }, reason: "Izmena podrazumevanog procenta" },
      tx,
    );
  });
  await evaluateCreditWarnings(user.id);
}

/** Da li kupac sme da pošalje porudžbinu (blokada je samo kada je uključena I dug je preko limita). */
export async function creditBlockFor(customerId: string): Promise<string | null> {
  try {
    return await creditBlockCheck(customerId);
  } catch (error) {
    // Provera limita ne sme da zaustavi porudžbinu zbog greške u čitanju (npr. tabela dugovanja nedostupna).
    console.error("kreditna blokada:", error);
    return null;
  }
}

async function creditBlockCheck(customerId: string): Promise<string | null> {
  const [o] = await getDb().select().from(customerCreditLimits).where(eq(customerCreditLimits.customerId, customerId)).limit(1);
  if (!o?.blockOrders) return null;
  const today = belgradeDate(new Date());
  const [gross, debts, defaultPercent] = await Promise.all([grossLast12Months([customerId], today), debtsInScopeOne(customerId, today), defaultCreditPercent()]);
  const lim = creditLimitFor({ gross12m: gross.get(customerId) ?? 0, override: { percent: o.percent === null ? null : Number(o.percent), amount: o.amount === null ? null : Number(o.amount) }, defaultPercent });
  const st = creditStatus({ debt: debts?.total ?? 0, limit: lim.limit, maxDaysOverdue: debts?.maxDaysOverdue ?? null });
  return st.status === "over" ? "Porudžbina trenutno ne može da se pošalje preko portala. Molimo Vas da se javite svom komercijalisti." : null;
}

async function debtsInScopeOne(customerId: string, today: string) {
  return (await debtsForAllCustomers(today)).find((d) => d.customerId === customerId) ?? null;
}

const money = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 0 });

/**
 * Upozorenja u zvoncu (posle svakog novog snimka tabele dugovanja i svake izmene limita):
 * dug preko limita i faktura koja kasni duže od 30 dana. Jedno otvoreno upozorenje po kupcu i
 * vrsti (`dedupe_key`); kada uslov nestane, upozorenje se zatvara samo, pa novo prekoračenje
 * ponovo javlja.
 */
export async function evaluateCreditWarnings(actorId: string | null) {
  const today = belgradeDate(new Date());
  const snap = await latestSnapshot();
  if (!snap) return;
  const [gross, debtRows, ov, defaultPercent] = await Promise.all([grossLast12Months(null, today), debtsForAllCustomers(today), overrides(null), defaultCreditPercent()]);
  const debts = new Map(debtRows.map((d) => [d.customerId, d]));
  const ids = new Set([...debts.keys(), ...ov.keys()]);
  const names = await namesOf([...ids]);
  const rows = buildRows(ids, names, gross, debts, ov, defaultPercent, new Map());
  const active = new Set<string>();
  for (const r of rows) {
    if (r.status === "over" && r.limit !== null) {
      const key = `credit:over:${r.customerId}`;
      active.add(key);
      await notify({
        kind: "credit_warning",
        severity: "warning",
        requiredCapability: "view:limiti",
        customerId: r.customerId,
        title: `${r.customerName}: dug preko limita`,
        body: `Duguje ${money(r.debt)} RSD, limit je ${money(r.limit)} RSD (${Math.round((r.usage ?? 0) * 100)} %).`,
        entityType: "Kreditni limit",
        entityId: r.customerId,
        actionHref: `/portal/limiti?kupac=${r.customerId}`,
        dedupeKey: key,
      });
    }
    if (r.late) {
      const key = `credit:late:${r.customerId}`;
      active.add(key);
      await notify({
        kind: "credit_warning",
        severity: "warning",
        requiredCapability: "view:limiti",
        customerId: r.customerId,
        title: `${r.customerName}: faktura kasni ${r.maxDaysOverdue} dana`,
        body: `Dospelo ${money(r.overdue)} RSD; najstarija faktura kasni više od ${LATE_DAYS} dana posle valute.`,
        entityType: "Kreditni limit",
        entityId: r.customerId,
        actionHref: `/portal/dugovanja/${r.customerId}`,
        dedupeKey: key,
      });
    }
  }
  // Uslov je nestao (platio, limit povećan) → otvoreno upozorenje se zatvara. Zatvaranje traži
  // korisnika (ograničenje tabele); bez njega upozorenje ostaje do sledeće provere.
  if (!actorId) return;
  await getDb().execute(sql`
    UPDATE notifications SET status = 'resolved', resolved_at = now(), resolved_by = ${actorId}::uuid,
           resolution_note = 'Uslov više ne važi (novi snimak dugovanja ili izmena limita).'
     WHERE kind::text = 'credit_warning' AND status <> 'resolved' AND dedupe_key IS NOT NULL
       ${active.size ? sql`AND dedupe_key NOT IN (${sql.join([...active].map((k) => sql`${k}`), sql`, `)})` : sql``}`);
}
