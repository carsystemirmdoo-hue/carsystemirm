import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";

/**
 * Program artikla (0040). Artikal van programa zadržava istoriju (fakture,
 * osnovne cene, pravila), ali NIJE u ponudi: nema cenu kupca, ne poručuje se,
 * ne preporučuje i ne ulazi u predloge rabata. Prisustvo u lageru, cenovniku
 * ili fakturi nije odluka o programu.
 */
export async function outOfProgrammeArticles(): Promise<{ ids: Set<string>; codes: Set<string> }> {
  const rows = await getDb().execute<{ id: string; code: string }>(sql`
    SELECT a.id, a.code FROM articles_out_of_programme o JOIN articles a ON a.id = o.article_id`);
  return { ids: new Set(rows.map((r) => r.id)), codes: new Set(rows.map((r) => r.code)) };
}

/**
 * Odluka o programu za skup artikala (samo vlasnik: `pricelist:manage`). Upisuje se samo
 * gde se stanje stvarno menja; ponovljena ista odluka ne pravi nov zapis.
 */
export async function setArticleProgramme(
  actor: PortalUser,
  input: { articleIds: string[]; inProgramme: boolean; reason: string; sourceBatch?: string },
) {
  if (!can(actor, "pricelist:manage")) throw new Error("Program artikla menja samo vlasnik.");
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) throw new Error("Obrazloženje mora imati 5–500 znakova.");
  const ids = [...new Set(input.articleIds)];
  if (!ids.length) return { changed: 0, unchanged: 0, batch: null as string | null };
  const batch = input.sourceBatch ?? `program-${randomUUID().slice(0, 8)}`;
  const db = getDb();
  return db.transaction(async (tx) => {
    const current = await tx.execute<{ id: string; out: boolean }>(sql`
      SELECT a.id, (o.article_id IS NOT NULL) AS out
        FROM articles a LEFT JOIN articles_out_of_programme o ON o.article_id = a.id
       WHERE a.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
    if (current.length !== ids.length) throw new Error("Neki artikli ne postoje.");
    const toChange = current.filter((r) => r.out === input.inProgramme).map((r) => r.id);
    for (const articleId of toChange) {
      await tx.execute(sql`
        INSERT INTO article_programme_decisions (article_id, in_programme, reason, source_batch, decided_by)
        VALUES (${articleId}::uuid, ${input.inProgramme}, ${reason}, ${batch}, ${actor.id}::uuid)`);
    }
    if (toChange.length) {
      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          action: AUDIT_ACTIONS.articleProgrammeChanged,
          entityType: "Program artikla",
          entityId: batch,
          entityLabel: batch,
          before: { vanPrograma: !input.inProgramme ? 0 : toChange.length },
          after: { uPrograma: input.inProgramme, artikala: toChange.length, istorijaZadrzana: true },
          reason,
          correlationId: batch,
        },
        tx,
      );
    }
    return { changed: toChange.length, unchanged: ids.length - toChange.length, batch };
  });
}
