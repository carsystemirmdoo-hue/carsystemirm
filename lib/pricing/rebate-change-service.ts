import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import { canAccessCustomer } from "@/lib/authz/scope.mjs";
import { loadAssignedCustomerIds, type PortalUser } from "@/lib/authz/user-repository";
import { classifyCustomer, familyCandidates } from "@/lib/pricing/rebateCoverage.mjs";
import { proposePriceRule, transitionPriceRule } from "@/lib/pricing/rule-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

/**
 * Promena rabata kupca (10.10.2026): pojedinačni artikal, potvrđena grupa
 * (porodica koju kupčeve fakture dokazuju) ili više izabranih artikala.
 *
 * Dva koraka: PREGLED (svi obuhvaćeni artikli, stari i novi rabat, izuzeci)
 * pa SLANJE. Server pri slanju ponovo računa pregled i odbija ako se stanje
 * promenilo. Predlog komercijaliste ne menja cenu dok ga gazda ne odobri;
 * gazda može odobriti odmah. Važeće pravilo se MENJA (0041: zamena), nikad
 * se ne dodaje drugo aktivno pravilo istog opsega (to bi bio sukob).
 *
 * Grupna promena ne gazi pojedinačne dogovore: artikal čije pravilo odstupa od
 * dosadašnjeg uslova grupe je IZUZETAK i ostaje izvan promene, osim ako ga
 * korisnik izričito uključi.
 */

const ACTIVE = ["approved_pending_biznisoft", "office_recorded", "confirmed"];
const PENDING = ["draft", "pending_approval"];

export type ChangeAction = "novo" | "zamena" | "bez_promene" | "izuzetak" | "ceka_odluku" | "van_programa";

export type ChangeRow = {
  articleId: string;
  articleCode: string;
  articleName: string;
  current: { ruleId: string; percent: number; effectiveFrom: string; origin: string } | null;
  pending: { percent: number } | null;
  lastInvoice: { label: string; issuedOn: string; percent: number } | null;
  action: ChangeAction;
  included: boolean;
  note: string | null;
};

export type ChangeInput = {
  customerId: string;
  mode: "artikli" | "grupa";
  articleIds?: string[];
  groupKey?: string;
  newPercent: number;
  effectiveFrom: string;
  /** Izuzeci (pojedinačni dogovori) koje korisnik IZRIČITO uključuje u grupnu promenu. */
  includeExceptions?: string[];
};

export class RebateChangeError extends Error {}

function originOf(sourceBatch: string | null): string {
  if (!sourceBatch) return "pojedinačni dogovor";
  if (sourceBatch.startsWith("rabati-v2-")) return "grupno odobrenje iz istorije";
  if (sourceBatch.startsWith("rabati-istorija-")) return "iz istorije faktura (stroga merila)";
  if (sourceBatch.startsWith("promena-")) return "ranija promena";
  return `serija ${sourceBatch}`;
}

async function assertCustomer(viewer: PortalUser, customerId: string) {
  if (!/^[0-9a-f-]{36}$/.test(customerId)) throw new RebateChangeError("Neispravan kupac.");
  const assigned = await loadAssignedCustomerIds(viewer.id);
  if (!canAccessCustomer(viewer, assigned, customerId)) throw new RebateChangeError("Kupac nije u Vašem opsegu.");
}

/** Potvrđene grupe kupca: porodice koje njegove fakture dokazuju (sa članstvom). */
export async function customerFamilies(viewer: PortalUser, customerId: string, asOf = belgradeDate(new Date())) {
  await assertCustomer(viewer, customerId);
  const data = await loadCustomer(customerId, asOf);
  const res = classifyCustomer({ lines: data.lines, rules: data.rules.map((r) => ({ articleId: r.articleId, discountPercent: r.percent, approved: ACTIVE.includes(r.status) })), outOfProgramme: data.out, asOf });
  return res.families
    .filter((f) => f.ok)
    .map((f) => ({
      key: f.key,
      percent: f.percent as number,
      evidence: { articles: f.articles, days: f.days, share: f.share, window: f.window as [string, string], actions: f.actions.length },
      members: [...data.articles.values()].filter((a) => !data.out.has(a.id) && familyCandidates(a.name).includes(f.key)).map((a) => ({ articleId: a.id, code: a.code, name: a.name })),
    }))
    .sort((a, b) => b.members.length - a.members.length);
}

async function loadCustomer(customerId: string, asOf: string) {
  const db = getDb();
  const [lines, rules, out] = await Promise.all([
    db.execute<{ a: string; code: string; n: string; inv: string; lbl: string; d: string; p: string }>(sql`
      SELECT il.article_id AS a, a.code, a.name AS n, ril.invoice_id AS inv, i.number || '/' || i.year AS lbl, ril.issued_on::text AS d, il.discount_percent::text AS p
        FROM recommendation_input_lines ril
        JOIN invoice_lines il ON il.id = ril.invoice_line_id
        JOIN invoices i ON i.id = ril.invoice_id
        JOIN articles a ON a.id = il.article_id
       WHERE ril.customer_id = ${customerId}::uuid AND ril.issued_on <= ${asOf}::date
       ORDER BY ril.issued_on, ril.invoice_id`),
    db.execute<{ id: string; article_id: string; p: string; status: string; effective_from: string; source_batch: string | null }>(sql`
      SELECT id, article_id, discount_percent::text AS p, status::text AS status, effective_from::text AS effective_from, source_batch
        FROM price_rules
       WHERE customer_scope = 'customer' AND customer_id = ${customerId}::uuid AND product_scope = 'article' AND value_kind = 'discount_percent'
         AND status::text IN (${sql.join([...ACTIVE, ...PENDING].map((s) => sql`${s}`), sql`, `)})
         AND (effective_to IS NULL OR effective_to >= ${asOf}::date)
         -- Odobreno pravilo sa budućim početkom još ne važi (zamena koja tek kreće).
         AND (status::text IN ('draft', 'pending_approval') OR effective_from <= ${asOf}::date)`),
    db.execute<{ a: string }>(sql`SELECT article_id AS a FROM articles_out_of_programme`),
  ]);
  const scheduled = await db.execute<{ article_id: string; p: string; f: string }>(sql`
    SELECT article_id, discount_percent::text AS p, effective_from::text AS f FROM price_rules
     WHERE customer_scope = 'customer' AND customer_id = ${customerId}::uuid AND product_scope = 'article'
       AND status::text IN (${sql.join(ACTIVE.map((s) => sql`${s}`), sql`, `)}) AND effective_from > ${asOf}::date`);
  const articles = new Map<string, { id: string; code: string; name: string }>();
  for (const l of lines) articles.set(l.a, { id: l.a, code: l.code, name: l.n });
  return {
    lines: lines.map((l) => ({ articleId: l.a, articleName: l.n, invoiceId: l.inv, documentLabel: l.lbl, issuedOn: l.d, discountPercent: Number(l.p) })),
    rawLines: [...lines],
    rules: rules.map((r) => ({ id: r.id, articleId: r.article_id, percent: Number(r.p), status: r.status, effectiveFrom: r.effective_from, sourceBatch: r.source_batch })),
    out: new Set(out.map((o) => o.a)),
    scheduled: new Map(scheduled.map((r) => [r.article_id, { percent: Number(r.p), from: r.f }])),
    articles,
  };
}

/** Pregled promene: svi obuhvaćeni artikli, stari i novi rabat, izuzeci. Ništa ne upisuje. */
export async function previewRebateChange(viewer: PortalUser, input: ChangeInput, asOf = belgradeDate(new Date())) {
  await assertCustomer(viewer, input.customerId);
  if (!(input.newPercent >= 0 && input.newPercent < 100)) throw new RebateChangeError("Rabat mora biti između 0 i 100 %.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom) || input.effectiveFrom < asOf) throw new RebateChangeError("Početak važenja ne sme biti u prošlosti.");
  const data = await loadCustomer(input.customerId, asOf);
  let ids: string[];
  let group: Awaited<ReturnType<typeof customerFamilies>>[number] | null = null;
  if (input.mode === "grupa") {
    group = (await customerFamilies(viewer, input.customerId, asOf)).find((f) => f.key === input.groupKey) ?? null;
    if (!group) throw new RebateChangeError("Grupa nije potvrđena fakturama ovog kupca.");
    ids = group.members.map((m) => m.articleId);
  } else {
    ids = [...new Set(input.articleIds ?? [])];
    if (!ids.length) throw new RebateChangeError("Izaberite bar jedan artikal.");
    const unknown = ids.filter((id) => !data.articles.has(id));
    if (unknown.length) throw new RebateChangeError("Neki izabrani artikli nisu na fakturama ovog kupca.");
  }
  const include = new Set(input.includeExceptions ?? []);
  const rows: ChangeRow[] = ids.map((articleId) => {
    const a = data.articles.get(articleId)!;
    const active = data.rules.filter((r) => r.articleId === articleId && ACTIVE.includes(r.status));
    const pending = data.rules.find((r) => r.articleId === articleId && PENDING.includes(r.status)) ?? null;
    const last = [...data.rawLines].reverse().find((l) => l.a === articleId);
    const cur = active.length === 1 ? active[0] : null;
    const base = {
      articleId,
      articleCode: a.code,
      articleName: a.name,
      current: cur ? { ruleId: cur.id, percent: cur.percent, effectiveFrom: cur.effectiveFrom, origin: originOf(cur.sourceBatch) } : null,
      pending: pending ? { percent: pending.percent } : null,
      lastInvoice: last ? { label: last.lbl, issuedOn: last.d, percent: Number(last.p) } : null,
    };
    if (data.out.has(articleId)) return { ...base, action: "van_programa", included: false, note: "artikal nije u programu" };
    if (active.length > 1) return { ...base, action: "izuzetak", included: false, note: "više važećih pravila — prvo razrešiti sukob" };
    if (pending) return { ...base, action: "ceka_odluku", included: false, note: `već čeka predlog ${pending.percent} %` };
    const sch = data.scheduled.get(articleId);
    if (sch) return { ...base, action: "izuzetak", included: false, note: `već zakazana promena ${sch.percent} % od ${sch.from}` };
    if (cur && Math.abs(cur.percent - input.newPercent) < 0.0005) return { ...base, action: "bez_promene", included: false, note: null };
    if (cur && cur.effectiveFrom >= input.effectiveFrom) return { ...base, action: "izuzetak", included: false, note: `postojeće pravilo počinje ${cur.effectiveFrom} — izaberite kasniji datum` };
    // Grupna promena: pravilo koje odstupa od dosadašnjeg uslova grupe je pojedinačni dogovor (izuzetak).
    if (group && cur && Math.abs(cur.percent - group.percent) >= 0.0005) {
      const inc = include.has(articleId);
      return { ...base, action: "izuzetak", included: inc, note: inc ? `izuzetak ${cur.percent} % IZRIČITO uključen` : `pojedinačni dogovor ${cur.percent} % (grupa ${group.percent} %) — nije uključen` };
    }
    return { ...base, action: cur ? "zamena" : "novo", included: true, note: null };
  });
  return {
    customerId: input.customerId,
    mode: input.mode,
    group: group ? { key: group.key, percent: group.percent, evidence: group.evidence, origin: "izvedena iz faktura kupca (nije BizniSoft grupa)", members: group.members.length } : null,
    newPercent: input.newPercent,
    effectiveFrom: input.effectiveFrom,
    rows,
  };
}

/**
 * Slanje promene. `expected` = šta je korisnik video u pregledu (artikal → pravilo
 * koje menja); ako se razlikuje od ponovo izračunatog pregleda, ništa se ne šalje.
 */
export async function submitRebateChange(
  viewer: PortalUser,
  input: ChangeInput & { reason: string; expected: { articleId: string; replacesRuleId: string | null }[]; approveNow?: boolean },
) {
  if (!can(viewer, "prices:propose")) throw new RebateChangeError("Nemate pravo da predlažete promenu rabata.");
  if (input.approveNow && !can(viewer, "prices:approve")) throw new RebateChangeError("Direktno odobrava samo vlasnik.");
  const reason = input.reason.trim();
  if (reason.length < 10 || reason.length > 800) throw new RebateChangeError("Obrazloženje: 10–800 znakova.");
  const preview = await previewRebateChange(viewer, input);
  const doing = preview.rows.filter((r) => r.included);
  const key = (x: { articleId: string; replacesRuleId: string | null }) => `${x.articleId}|${x.replacesRuleId ?? ""}`;
  const now = new Set(doing.map((r) => key({ articleId: r.articleId, replacesRuleId: r.current?.ruleId ?? null })));
  const seen = new Set(input.expected.map(key));
  if (!doing.length) throw new RebateChangeError("Nema artikala za promenu.");
  if (now.size !== seen.size || [...now].some((k) => !seen.has(k))) {
    throw new RebateChangeError("Stanje se promenilo od pregleda (pravila ili predlozi). Otvorite pregled ponovo.");
  }
  const batchId = `promena-${input.effectiveFrom}-${randomUUID().slice(0, 8)}`;
  const origin = preview.group
    ? `grupa „${preview.group.key}“ (${preview.group.origin}; ${preview.group.evidence.articles} artikala, ${preview.group.evidence.days} dana, ${Math.round(preview.group.evidence.share * 100)} % stavki sa ${preview.group.percent} %)`
    : doing.length === 1 ? "pojedinačni artikal" : `${doing.length} izabranih artikala`;
  const created: string[] = [];
  for (const r of doing) {
    const rule = await proposePriceRule(
      {
        customerScope: "customer",
        customerId: input.customerId,
        productScope: "article",
        articleId: r.articleId,
        valueKind: "discount_percent",
        discountPercent: input.newPercent,
        effectiveFrom: input.effectiveFrom,
        reason: `${reason} — Obuhvat: ${origin}. ${r.current ? `Menja ${r.current.percent} % (${r.current.origin}, od ${r.current.effectiveFrom}).` : "Novo pravilo."}${r.lastInvoice ? ` Poslednja faktura ${r.lastInvoice.label} ${r.lastInvoice.issuedOn}: ${r.lastInvoice.percent} %.` : ""}`.slice(0, 2000),
        biznisoftEntryRequired: false,
        sourceBatch: batchId,
        replacesRuleId: r.current?.ruleId ?? null,
      },
      viewer,
      { correlationId: batchId, notify: false },
    );
    if (input.approveNow) {
      await transitionPriceRule({ ruleId: rule.id, to: "approved_pending_biznisoft", reason: `Direktno odobrenje promene ${batchId}` }, viewer, { correlationId: batchId, notify: false });
    }
    created.push(rule.id);
  }
  await recordAudit({
    actor: { id: viewer.id, name: viewer.name, role: viewer.role },
    action: AUDIT_ACTIONS.rebateGroupApproved,
    entityType: "Serija pravila cene",
    entityId: batchId,
    entityLabel: `${origin} · ${input.newPercent} % od ${input.effectiveFrom}`,
    before: null,
    after: {
      kupac: input.customerId,
      pravila: created.length,
      zamena: doing.filter((r) => r.current).length,
      izuzeciUkljuceni: doing.filter((r) => r.action === "izuzetak").length,
      izuzeciNeukljuceni: preview.rows.filter((r) => r.action === "izuzetak" && !r.included).length,
      odobrenoOdmah: Boolean(input.approveNow),
    },
    reason,
    correlationId: batchId,
  });
  return { batchId, count: created.length, approved: Boolean(input.approveNow) };
}
