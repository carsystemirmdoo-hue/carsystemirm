import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";
import { familyCandidates } from "@/lib/pricing/rebateCoverage.mjs";

/**
 * Pregledane grupe artikala (brend). Prefiks naziva daje samo PREDLOG; grupa
 * važi za rabat tek kada je vlasnik potvrdi — tada se `articles.brand` upisuje
 * (uvoz faktura menja samo naziv, brend ostaje). BizniSoft grupe, kada stignu,
 * idu kao `product_group`.
 */
export async function brandProposals() {
  const rows = await getDb().execute<{ id: string; code: string; name: string; brand: string | null; out: boolean }>(sql`
    SELECT a.id, a.code, a.name, a.brand, EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out FROM articles a ORDER BY a.code`);
  const groups = new Map<string, { brand: string; proposed: number; confirmed: number; other: number; outOfProgramme: number; examples: string[]; ids: string[] }>();
  for (const a of rows) {
    const b = familyCandidates(a.name)[0];
    if (!b || b.includes(" ")) continue; // samo brendovi; opšti nazivi nisu grupa
    const g = groups.get(b) ?? { brand: b, proposed: 0, confirmed: 0, other: 0, outOfProgramme: 0, examples: [], ids: [] };
    g.proposed++;
    if (a.brand === b) g.confirmed++;
    else if (a.brand) g.other++;
    else g.ids.push(a.id);
    if (a.out) g.outOfProgramme++;
    if (g.examples.length < 4) g.examples.push(`${a.code} ${a.name}`);
    groups.set(b, g);
  }
  return [...groups.values()].sort((x, y) => y.proposed - x.proposed);
}

/** Potvrda grupe: upisuje brend artiklima iz predloga koji ga još nemaju (ne gazi drugačije upisan brend). */
export async function confirmBrand(actor: PortalUser, input: { brand: string; reason: string }) {
  if (!can(actor, "prices:approve")) throw new Error("Grupe artikala potvrđuje samo vlasnik.");
  const reason = input.reason.trim();
  if (reason.length < 5) throw new Error("Obrazloženje: najmanje 5 znakova.");
  const g = (await brandProposals()).find((x) => x.brand === input.brand);
  if (!g) throw new Error("Nepoznata grupa.");
  if (!g.ids.length) return { assigned: 0 };
  const batch = `grupa-${input.brand}-${randomUUID().slice(0, 8)}`;
  await getDb().transaction(async (tx) => {
    await tx.execute(sql`UPDATE articles SET brand = ${input.brand}, updated_at = now()
                          WHERE id IN (${sql.join(g.ids.map((i) => sql`${i}::uuid`), sql`, `)}) AND brand IS NULL`);
    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.articleGroupConfirmed,
        entityType: "Grupa artikala",
        entityId: batch,
        entityLabel: input.brand,
        before: { bezGrupe: g.ids.length },
        after: { grupa: input.brand, artikala: g.ids.length, izvor: "prefiks naziva, pregledao vlasnik" },
        reason,
        correlationId: batch,
      },
      tx,
    );
  });
  return { assigned: g.ids.length };
}
