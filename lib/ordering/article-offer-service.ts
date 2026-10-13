import "server-only";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { can } from "@/lib/authz/permissions.mjs";
import type { PortalUser } from "@/lib/authz/user-repository";

/**
 * Ponuda artikla (0049): artikal koji trenutno ne prodajemo direktno (nije na lageru, nije uvožen,
 * ponuda se proverava) ostaje vidljiv, ali se nudi SAMO kroz upit za nabavku — ne dodaje se u korpu.
 * Odluke se samo dodaju; važi poslednja. Ovo nije odluka o programu (van programa = uklanjanje, 0040).
 */
export async function setArticleProcurementOnly(
  actor: PortalUser,
  input: { articleIds: string[]; procurementOnly: boolean; reason: string; sourceBatch?: string },
) {
  if (!can(actor, "pricelist:manage")) throw new Error("Ponudu artikla menja samo vlasnik.");
  const reason = input.reason.trim();
  if (reason.length < 5 || reason.length > 500) throw new Error("Obrazloženje mora imati 5–500 znakova.");
  const ids = [...new Set(input.articleIds)];
  if (!ids.length) return { changed: 0, unchanged: 0, batch: null as string | null };
  const batch = input.sourceBatch ?? `ponuda-${randomUUID().slice(0, 8)}`;
  return getDb().transaction(async (tx) => {
    const current = await tx.execute<{ id: string; only: boolean }>(sql`
      SELECT a.id, (p.article_id IS NOT NULL) AS only
        FROM articles a LEFT JOIN articles_procurement_only p ON p.article_id = a.id
       WHERE a.id IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
    if (current.length !== ids.length) throw new Error("Neki artikli ne postoje.");
    const toChange = current.filter((r) => r.only !== input.procurementOnly).map((r) => r.id);
    for (const articleId of toChange) {
      await tx.execute(sql`
        INSERT INTO article_offer_decisions (article_id, procurement_only, reason, source_batch, decided_by)
        VALUES (${articleId}::uuid, ${input.procurementOnly}, ${reason}, ${batch}, ${actor.id}::uuid)`);
    }
    if (toChange.length) {
      await recordAudit(
        {
          actor: { id: actor.id, name: actor.name, role: actor.role },
          action: AUDIT_ACTIONS.articleOfferChanged,
          entityType: "Ponuda artikla",
          entityId: batch,
          entityLabel: batch,
          before: { samoUpitZaNabavku: !input.procurementOnly },
          after: { samoUpitZaNabavku: input.procurementOnly, artikala: toChange.length },
          reason,
          correlationId: batch,
        },
        tx,
      );
    }
    return { changed: toChange.length, unchanged: ids.length - toChange.length, batch };
  });
}
