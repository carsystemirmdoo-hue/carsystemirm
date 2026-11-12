import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { parseDeviceDocumentBody } from "@/lib/sync/contract/deviceDocument.mjs";
import { ContractRejection } from "@/lib/sync/contract/validate.mjs";
import { BodyError, parseJsonBody } from "@/lib/sync/http/gate";
import { syncJson, withAuthenticatedDevice } from "@/lib/sync/http/handler";
import { ingestDeviceDocument } from "@/lib/sync/ingestDeviceDocument";

/**
 * Prijem storna i knjižnog odobrenja sa uređaja, kao PDF (2026-11-12, konektor 0.3.14).
 *
 * Potpis, granice tela i rate limit sprovodi `withAuthenticatedDevice`, isto kao za fakture.
 * Odgovor nosi samo ishod i interne identifikatore — bez kupca, iznosa i broja dokumenta.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "/api/sync/document";

export async function POST(request: Request): Promise<Response> {
  return withAuthenticatedDevice(request, PATH, async ({ device, bodyBytes, requestId }) => {
    let telo: unknown;
    try {
      telo = parseJsonBody(bodyBytes);
    } catch (error) {
      if (error instanceof BodyError) return syncJson(error.status, { ok: false, code: error.code, requestId });
      return syncJson(400, { ok: false, code: "body_unreadable", requestId });
    }

    const actor = {
      kind: "device" as const,
      deviceId: device.deviceId,
      name: `Uređaj ${device.deviceCode}`,
      role: "sync_device",
    };

    const dokument = parseDeviceDocumentBody(telo);
    if (!dokument.ok) {
      await recordAudit({
        actor,
        action: AUDIT_ACTIONS.pdfDuplicateSkipped,
        entityType: "Prijem sa uređaja",
        entityLabel: `dev:${device.deviceCode}`,
        reason: `PDF dokument odbijen: ${dokument.code}`,
      }).catch(() => {});
      return syncJson(422, { ok: false, code: dokument.code, requestId });
    }

    try {
      const outcome = await ingestDeviceDocument(
        { kind: dokument.kind, bytes: dokument.bytes },
        { issuerCode: device.issuerCode, deviceId: device.deviceId },
        actor,
      );
      const telo: Record<string, unknown> = { ok: true, code: outcome.result, requestId };
      if ("sourceDocumentId" in outcome && outcome.sourceDocumentId) telo.sourceDocumentId = outcome.sourceDocumentId;
      if ("invoiceId" in outcome && outcome.invoiceId) telo.invoiceId = outcome.invoiceId;
      const trazi_pregled =
        outcome.result === "business_key_conflict" ||
        outcome.result === "source_hash_content_mismatch" ||
        outcome.result === "already_imported_other_source";
      return syncJson(trazi_pregled ? 409 : 200, telo as never);
    } catch (error) {
      if (error instanceof ContractRejection) {
        await recordAudit({
          actor,
          action: AUDIT_ACTIONS.pdfDuplicateSkipped,
          entityType: "Prijem sa uređaja",
          entityLabel: `dev:${device.deviceCode}`,
          reason: `PDF dokument odbijen: ${error.code}`,
        }).catch(() => {});
        return syncJson(422, { ok: false, code: error.code, requestId });
      }
      return syncJson(500, { ok: false, code: "ingest_failed", requestId });
    }
  });
}
