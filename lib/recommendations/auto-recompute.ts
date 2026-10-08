import "server-only";
import { sql } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db/client";
import { recordAudit } from "@/lib/audit/record";
import type { PortalUser } from "@/lib/authz/user-repository";
import { isAutoRecomputeEnabled } from "@/lib/recommendations/gate";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { recomputeRecommendations, RecomputeError, type RecomputeSummary } from "@/lib/recommendations/recompute";

/**
 * Automatski obračun preporuka posle uspešnog uvoza (0032).
 *
 * Uvoz upisuje ZAHTEV (`requestRecomputeAfterIngest`), a obrada ga izvršava
 * posle odgovora (`scheduleRecomputeProcessing` → `processRecomputeQueue`).
 *
 *  - Niz dokumenata iz jednog skeniranja daje JEDAN obračun: najviše jedan
 *    zahtev čeka, i svaki novi dokument ga samo osvežava.
 *  - Ponovljen uvoz bez novih podataka ne pravi zahtev: otisak ulaza (broj
 *    ulaznih stavki + poslednji uvoz) je isti kao kod poslednjeg zahteva.
 *  - Neuspeh ostaje zapisan (`failed`, kod i kratko objašnjenje), prethodni
 *    aktivan obračun važi dalje, a zahtev se može ponoviti.
 */

export type RecomputeSource = "device" | "manual_upload" | "customer_mapping";
/** Obrada duža od ovoga smatra se prekinutom (npr. ugašena funkcija). */
export const RUNNING_TIMEOUT_MS = 15 * 60 * 1000;

async function inputFingerprint(): Promise<string> {
  const [r] = [
    ...(await getDb().execute<{ n: number; last: string | null }>(sql`
      SELECT count(*)::int AS n, max(sd.created_at)::text AS last
        FROM recommendation_input_lines ril JOIN source_documents sd ON sd.id = ril.source_document_id`)),
  ];
  return `${r?.n ?? 0}|${r?.last ?? "-"}`;
}

export type EnqueueResult =
  | { status: "disabled" }
  | { status: "unchanged"; requestId: string | null }
  | { status: "queued" | "merged"; requestId: string };

/**
 * Posle uspešnog uvoza: upiši ili osveži zahtev za obračun. Ne računa ništa i
 * ne baca grešku ka uvozu — uvoz je već uspeo i ne sme pasti zbog preporuka.
 */
export async function requestRecomputeAfterIngest(source: RecomputeSource, documents = 1): Promise<EnqueueResult> {
  if (!isAutoRecomputeEnabled()) return { status: "disabled" };
  const db = getDb();
  const fingerprint = await inputFingerprint();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('recommendation_recompute_enqueue'))`);
    const [pending] = [
      ...(await tx.execute<{ id: string; input_fingerprint: string }>(sql`
        SELECT id, input_fingerprint FROM recommendation_recompute_requests WHERE status = 'pending' LIMIT 1`)),
    ];
    if (pending) {
      if (pending.input_fingerprint === fingerprint) return { status: "unchanged" as const, requestId: pending.id };
      await tx.execute(sql`
        UPDATE recommendation_recompute_requests
           SET input_fingerprint = ${fingerprint}, document_count = document_count + ${documents}, updated_at = now()
         WHERE id = ${pending.id}`);
      return { status: "merged" as const, requestId: pending.id };
    }
    /*
     * Poslednji zahtev nad ISTIM ulazom → nema šta novo da se računa. Važi i za
     * neuspeli: ponovljen uvoz bez novih podataka ne ponavlja obračun tiho i
     * ne skriva grešku — neuspeh se ponavlja dugmetom.
     */
    const [last] = [
      ...(await tx.execute<{ id: string; input_fingerprint: string }>(sql`
        SELECT id, input_fingerprint FROM recommendation_recompute_requests
         WHERE status IN ('running', 'succeeded', 'failed') ORDER BY requested_at DESC LIMIT 1`)),
    ];
    if (last && last.input_fingerprint === fingerprint) return { status: "unchanged" as const, requestId: last.id };
    const [row] = [
      ...(await tx.execute<{ id: string }>(sql`
        INSERT INTO recommendation_recompute_requests (source, input_fingerprint, document_count)
        VALUES (${source}, ${fingerprint}, ${documents}) RETURNING id`)),
    ];
    return { status: "queued" as const, requestId: row.id };
  });
}

type Recompute = (requestId: string, asOfDate: string) => Promise<RecomputeSummary>;
const defaultRecompute: Recompute = (requestId, asOfDate) =>
  recomputeRecommendations({ customerIds: null }, { asOfDate }, { source: "ingest", requestId });

export type ProcessResult = { processed: number; succeeded: number; failed: number; deferred: boolean };

/**
 * Obrađuje zahteve koji čekaju. Bezbedno je pozvati je više puta i iz više
 * procesa: zahtev se preuzima pod zaključavanjem, a jedan obračun u isto
 * vreme čuva i `recommendation_runs_one_running`.
 */
export async function processRecomputeQueue(options: { now?: Date; recompute?: Recompute; maxRounds?: number } = {}): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, succeeded: 0, failed: 0, deferred: false };
  if (!isAutoRecomputeEnabled()) return result;
  const db = getDb();
  const recompute = options.recompute ?? defaultRecompute;

  // Zaglavljen „running" (npr. funkcija ugašena usred obračuna) postaje vidljiv neuspeh.
  await db.execute(sql`
    UPDATE recommendation_recompute_requests
       SET status = 'failed', failure_code = 'timeout', finished_at = now(), updated_at = now(),
           failure_detail = 'Obračun nije završen u roku od 15 minuta; pokrenite ga ponovo.'
     WHERE status = 'running' AND started_at < now() - ${`${RUNNING_TIMEOUT_MS / 1000} seconds`}::interval`);

  for (let round = 0; round < (options.maxRounds ?? 3); round += 1) {
    const claimed = await db.transaction(async (tx) => {
      const [r] = [
        ...(await tx.execute<{ id: string }>(sql`
          SELECT id FROM recommendation_recompute_requests
           WHERE status = 'pending' ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED`)),
      ];
      if (!r) return null;
      const [busy] = [...(await tx.execute<{ id: string }>(sql`SELECT id FROM recommendation_recompute_requests WHERE status = 'running' LIMIT 1`))];
      if (busy) return "busy" as const;
      await tx.execute(sql`
        UPDATE recommendation_recompute_requests
           SET status = 'running', attempts = attempts + 1, started_at = now(), updated_at = now(),
               failure_code = NULL, failure_detail = NULL
         WHERE id = ${r.id}`);
      return r.id;
    });
    if (claimed === null) break;
    if (claimed === "busy") {
      result.deferred = true;
      break;
    }

    result.processed += 1;
    const asOfDate = belgradeDate(options.now ?? new Date());
    try {
      const summary = await recompute(claimed, asOfDate);
      await db.execute(sql`
        UPDATE recommendation_recompute_requests
           SET status = 'succeeded', run_id = ${summary.runId}, finished_at = now(), updated_at = now()
         WHERE id = ${claimed}`);
      result.succeeded += 1;
    } catch (error) {
      if (error instanceof RecomputeError && error.code === "already_running") {
        // Ručni obračun je u toku: zahtev se vraća u red (ili ga pokriva noviji), bez računanja pokušaja.
        await db.transaction(async (tx) => {
          const [other] = [...(await tx.execute<{ id: string }>(sql`SELECT id FROM recommendation_recompute_requests WHERE status = 'pending' LIMIT 1`))];
          if (other) {
            await tx.execute(sql`
              UPDATE recommendation_recompute_requests SET status = 'superseded', finished_at = now(), updated_at = now()
               WHERE id = ${claimed}`);
          } else {
            await tx.execute(sql`
              UPDATE recommendation_recompute_requests
                 SET status = 'pending', attempts = greatest(attempts - 1, 0), started_at = NULL, updated_at = now()
               WHERE id = ${claimed}`);
          }
        });
        result.deferred = true;
        break;
      }
      const code = error instanceof RecomputeError ? error.code : "unexpected";
      const detail =
        error instanceof RecomputeError
          ? error.message
          : "Obračun preporuka nije uspeo. Prethodni obračun važi dalje; pokrenite ponovo ili proverite zapis prolaza.";
      await db.execute(sql`
        UPDATE recommendation_recompute_requests
           SET status = 'failed', failure_code = ${code}, failure_detail = ${detail.slice(0, 300)},
               finished_at = now(), updated_at = now()
         WHERE id = ${claimed}`);
      result.failed += 1;
    }
  }
  return result;
}

/**
 * Pokreće obradu POSLE odgovora na zahtev (uvoz ne čeka obračun). Van
 * Next.js zahteva (testovi, skripte) ne radi ništa — pozivalac tada sam
 * poziva `processRecomputeQueue`.
 */
export function scheduleRecomputeProcessing() {
  if (!isAutoRecomputeEnabled()) return;
  try {
    after(() => processRecomputeQueue().then(() => undefined).catch(() => undefined));
  } catch {
    // Izvan zahteva: nema šta da se odloži.
  }
}

/** Ponovo pokreće NEUSPELI zahtev (kancelarija/gazda sa `recommendations:recompute`). */
export async function retryRecomputeRequest(requestId: string, actor: PortalUser): Promise<{ ok: boolean; message: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(requestId)) return { ok: false, message: "Zahtev ne postoji." };
  const db = getDb();
  const moved = await db.transaction(async (tx) => {
    const [pending] = [...(await tx.execute<{ id: string }>(sql`SELECT id FROM recommendation_recompute_requests WHERE status = 'pending' LIMIT 1`))];
    if (pending) {
      // Već postoji zahtev koji čeka — on će obuhvatiti i ovaj ulaz.
      await tx.execute(sql`
        UPDATE recommendation_recompute_requests SET status = 'superseded', updated_at = now()
         WHERE id = ${requestId} AND status = 'failed'`);
      return "merged" as const;
    }
    const rows = [
      ...(await tx.execute<{ id: string }>(sql`
        UPDATE recommendation_recompute_requests
           SET status = 'pending', retried_by = ${actor.id}, requested_at = now(), updated_at = now(),
               started_at = NULL, finished_at = NULL
         WHERE id = ${requestId} AND status = 'failed' RETURNING id`)),
    ];
    return rows.length ? ("queued" as const) : null;
  });
  if (!moved) return { ok: false, message: "Samo neuspeo obračun može da se ponovi." };
  await recordAudit({
    actor: { id: actor.id, name: actor.name, role: actor.role },
    action: "recommendation.recompute_retried",
    entityType: "Preporuke — zahtev za obračun",
    entityId: requestId,
    reason: "Ponovljen neuspeli automatski obračun posle uvoza.",
  });
  return { ok: true, message: moved === "merged" ? "Novi zahtev već čeka i obuhvatiće i ove podatke." : "Obračun je ponovo u redu." };
}

export type RecomputeStatus = {
  enabled: boolean;
  latest: {
    id: string; status: string; source: string; documentCount: number; attempts: number;
    requestedAt: Date; finishedAt: Date | null; failureCode: string | null; failureDetail: string | null;
  } | null;
  pending: boolean;
};

/** Stanje za ekran: poslednji zahtev i da li nešto čeka. */
export async function loadRecomputeStatus(): Promise<RecomputeStatus> {
  const rows = await getDb().execute<{
    id: string; status: string; source: string; document_count: number; attempts: number;
    requested_at: Date; finished_at: Date | null; failure_code: string | null; failure_detail: string | null;
  }>(sql`
    SELECT id, status, source, document_count, attempts, requested_at, finished_at, failure_code, failure_detail
      FROM recommendation_recompute_requests
     WHERE status <> 'superseded'
     ORDER BY requested_at DESC LIMIT 1`);
  const r = [...rows][0];
  const [p] = [...(await getDb().execute<{ n: number }>(sql`SELECT count(*)::int AS n FROM recommendation_recompute_requests WHERE status = 'pending'`))];
  return {
    enabled: isAutoRecomputeEnabled(),
    pending: (p?.n ?? 0) > 0,
    latest: r
      ? {
          id: r.id, status: r.status, source: r.source, documentCount: r.document_count, attempts: r.attempts,
          requestedAt: new Date(r.requested_at), finishedAt: r.finished_at ? new Date(r.finished_at) : null,
          failureCode: r.failure_code, failureDetail: r.failure_detail,
        }
      : null,
  };
}
