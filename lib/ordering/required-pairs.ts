import "server-only";
import { sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import { requiredCompanionQuantities, requiredPairMessage, requiredPairProblems } from "@/lib/ordering/requiredPairs.mjs";

/*
 * Obavezan par u jednakoj količini (0056) — sprovođenje na serveru.
 *
 * - Korpa: posle svake promene posude poklopac se postavlja na zbir posuda (0 → uklanja se).
 * - Poklopac kupac ne menja ni ne uklanja sam (`lidEditProblem`).
 * - Slanje i izmenjen predlog kancelarije: `requiredPairBlockers` nad stavkama koje se upisuju.
 * Pravilo `requiredPairs.mjs` je jedino mesto računa.
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Exec = Database | Tx;

export type RequiredPair = { articleId: string; companionId: string; articleName: string; companionName: string };

/** Aktivni parovi u kojima učestvuje bar jedan od artikala (kao posuda ili kao poklopac). */
export async function loadRequiredPairs(exec: Exec, articleIds: string[]): Promise<RequiredPair[]> {
  const ids = [...new Set(articleIds)].filter(Boolean);
  if (!ids.length) return [];
  const list = sql.join(ids.map((id) => sql`${id}::uuid`), sql`, `);
  // Svi parovi dotaknutih poklopaca: poklopac = zbir SVIH njegovih posuda.
  const rows = await exec.execute<{ article_id: string; companion_article_id: string; article_name: string; companion_name: string }>(sql`
    SELECT r.article_id, r.companion_article_id,
           coalesce(sa.name, a.name) AS article_name, coalesce(sc.name, c.name) AS companion_name
      FROM article_required_pairs r
      JOIN articles a ON a.id = r.article_id
      JOIN articles c ON c.id = r.companion_article_id
      LEFT JOIN article_sales_names sa ON sa.article_id = r.article_id
      LEFT JOIN article_sales_names sc ON sc.article_id = r.companion_article_id
     WHERE r.revoked_at IS NULL
       AND r.companion_article_id IN (
         SELECT companion_article_id FROM article_required_pairs
          WHERE revoked_at IS NULL AND (article_id IN (${list}) OR companion_article_id IN (${list})))`);
  return [...rows].map((r) => ({ articleId: r.article_id, companionId: r.companion_article_id, articleName: r.article_name, companionName: r.companion_name }));
}

const LID_MANUAL = "Poklopac se ne poručuje i ne menja posebno: dodaje se sam, uvek u istom broju kao odgovarajuće posude. Promenite broj posuda.";

/** Zabrana ručne izmene poklopca. Izmena na tačno potreban broj (ili uklanjanje viška bez posude) je dozvoljena. */
export async function lidEditProblem(exec: Exec, customerId: string, articleId: string, newQuantity: number | null): Promise<string | null> {
  const pairs = await loadRequiredPairs(exec, [articleId]);
  if (!pairs.some((p) => p.companionId === articleId)) return null;
  const cart = await cartLines(exec, customerId);
  const need = requiredCompanionQuantities(pairs, cart).get(articleId) ?? 0;
  if (newQuantity !== null && Math.abs(newQuantity - need) < 1e-9) return null;
  if (newQuantity === null && need === 0) return null;
  return LID_MANUAL;
}

async function cartLines(exec: Exec, customerId: string) {
  const rows = await exec.execute<{ article_id: string; quantity: string }>(sql`
    SELECT article_id, quantity::text AS quantity FROM customer_cart_items WHERE customer_id = ${customerId}`);
  return [...rows].map((r) => ({ articleId: r.article_id, quantity: Number(r.quantity) }));
}

export class RequiredPairError extends Error {}

/**
 * Usklađuje poklopce u korpi sa posudama (u istoj transakciji kao promena posude).
 * Poklopac koji se ne može poručiti (van programa, bez potvrđenog pakovanja od celog broja) → greška,
 * pa se cela promena vraća: posuda ne sme u korpu bez poklopca.
 */
export async function syncRequiredPairs(tx: Tx, customerId: string, accountId: string | null) {
  const cart = await cartLines(tx, customerId);
  const pairs = await loadRequiredPairs(tx, cart.map((c) => c.articleId));
  if (!pairs.length) return;
  const need = requiredCompanionQuantities(pairs, cart);
  for (const [lid, required] of need) {
    if (required <= 0) {
      await tx.execute(sql`DELETE FROM customer_cart_items WHERE customer_id = ${customerId} AND article_id = ${lid}::uuid`);
      continue;
    }
    const [f] = [...(await tx.execute<{ out: boolean; pack_quantity: string | null }>(sql`
      SELECT EXISTS (SELECT 1 FROM articles_out_of_programme o WHERE o.article_id = a.id) AS out, ps.pack_quantity::text AS pack_quantity
        FROM articles a LEFT JOIN article_pack_sizes ps ON ps.article_id = a.id WHERE a.id = ${lid}::uuid`))];
    const name = pairs.find((p) => p.companionId === lid)?.companionName ?? "poklopac";
    const packQty = f?.pack_quantity ? Number(f.pack_quantity) : null;
    const packs = packQty ? required / packQty : NaN;
    if (!f || f.out || !packQty || !Number.isInteger(Math.round(packs * 1e9) / 1e9)) {
      throw new RequiredPairError(`Posuda se trenutno ne može poručiti: obavezan poklopac (${name}) nije dostupan u istom broju komada. Javite se kancelariji.`);
    }
    await tx.execute(sql`
      INSERT INTO customer_cart_items (customer_id, article_id, quantity, pack_count, added_by)
      VALUES (${customerId}, ${lid}::uuid, ${required}, ${Math.round(packs)}, ${accountId})
      ON CONFLICT (customer_id, article_id)
      DO UPDATE SET quantity = EXCLUDED.quantity, pack_count = EXCLUDED.pack_count, updated_at = now()
      WHERE customer_cart_items.quantity IS DISTINCT FROM EXCLUDED.quantity OR customer_cart_items.pack_count IS DISTINCT FROM EXCLUDED.pack_count`);
  }
}

/** Blokade slanja: svaki par mora biti jednak (stavke koje se UPISUJU, ne prikaz). */
export async function requiredPairBlockers(exec: Exec, lines: { articleId: string; quantity: number }[]): Promise<string[]> {
  const pairs = await loadRequiredPairs(exec, lines.map((l) => l.articleId));
  if (!pairs.length) return [];
  const names = new Map(pairs.map((p) => [p.companionId, p.companionName]));
  return requiredPairProblems(pairs, lines).map((p) => requiredPairMessage(p, (id: string) => names.get(id) ?? "Poklopac"));
}

/** Za prikaz u korpi: koji artikli su poklopci (bez ručne izmene) i uz koje posude idu. */
export async function requiredPairView(exec: Exec, articleIds: string[]) {
  const pairs = await loadRequiredPairs(exec, articleIds);
  const locked = new Map<string, string[]>();
  for (const p of pairs) if (articleIds.includes(p.articleId)) locked.set(p.companionId, [...(locked.get(p.companionId) ?? []), p.articleName]);
  return locked;
}
