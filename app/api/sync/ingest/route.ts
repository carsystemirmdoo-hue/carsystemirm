import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { requestRecomputeAfterIngest, scheduleRecomputeProcessing } from "@/lib/recommendations/auto-recompute";
import { ContractRejection, ingestCanonicalInvoice } from "@/lib/sync/ingestCanonical";
import { BodyError, parseJsonBody } from "@/lib/sync/http/gate";
import { syncJson, withAuthenticatedDevice } from "@/lib/sync/http/handler";

/**
 * Prijem potpisanog canonical dokumenta sa uređaja.
 *
 * Ruta ne radi ništa sama: `withAuthenticatedDevice` sprovodi feature gate,
 * granice tela, rate limit i potpis, a `ingestCanonicalInvoice` postojeću
 * validaciju i knjiženje kroz `ingestParsedDocument`. Ovde stoji samo
 * prevođenje ishoda u HTTP.
 *
 * `force-dynamic` i `nodejs`: potpis se proverava preko `node:crypto`, koji u
 * Edge runtime-u nema Ed25519. Keširanje bi bilo besmisleno i opasno.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PATH = "/api/sync/ingest";

export async function POST(request: Request): Promise<Response> {
  return withAuthenticatedDevice(request, PATH, async ({ device, bodyBytes, requestId }) => {
    let payload: unknown;
    try {
      payload = parseJsonBody(bodyBytes);
    } catch (error) {
      if (error instanceof BodyError) {
        return syncJson(error.status, { ok: false, code: error.code, requestId });
      }
      return syncJson(400, { ok: false, code: "body_unreadable", requestId });
    }

    /*
     * Akter je UREĐAJ, ne čovek koji ga je registrovao.
     *
     * `kind: "device"` traži `deviceId` i zabranjuje korisnika — provera stoji i
     * u `buildAuditEntry` i kao CHECK u bazi.
     */
    const actor = {
      kind: "device" as const,
      deviceId: device.deviceId,
      name: `Uređaj ${device.deviceCode}`,
      role: "sync_device",
    };

    try {
      const outcome = await ingestCanonicalInvoice(
        payload,
        {
          /*
           * Opseg iz REGISTRACIJE uređaja, nikad iz payloada.
           *
           * `validateCanonicalInvoice` poredi `issuer.code` iz sadržaja sa ovom
           * vrednošću i odbija nesaglasje. Payload koji sam sebi dodeli
           * izdavaoca tako ne prolazi ni sa savršenim potpisom.
           */
          issuerCode: device.issuerCode,
          origin: "device",
          deviceId: device.deviceId,
          /*
           * `runId` se NE prima iz zahteva.
           *
           * Tuđi broj prolaza bi postao strani ključ ovog uvoza i vezao ga za
           * tuđu istoriju. Server ga dodeljuje ili ostavlja prazan.
           */
        },
        actor,
      );

      /*
       * Uspešno proknjižen dokument → zahtev za obračun preporuka. Uvoz je već
       * uspeo i ne sme pasti zbog preporuka; zahtevi iz jednog skeniranja se
       * spajaju u jedan obračun, koji se izvršava posle odgovora.
       */
      if (outcome.result === "ingested") {
        await requestRecomputeAfterIngest("device").catch(() => undefined);
        scheduleRecomputeProcessing();
      }

      /*
       * Odgovor nosi ishod i INTERNE identifikatore, ne sadržaj.
       *
       * Bez naziva kupca, iznosa, broja računa, imena fajla i bez ijednog
       * hash-a — otisak tuđeg dokumenta je i sam podatak.
       */
      const telo: Record<string, unknown> = { ok: true, code: outcome.result, requestId };
      if ("sourceDocumentId" in outcome && outcome.sourceDocumentId) {
        telo.sourceDocumentId = outcome.sourceDocumentId;
      }
      if ("invoiceId" in outcome && outcome.invoiceId) telo.invoiceId = outcome.invoiceId;
      if ("comparable" in outcome) telo.comparable = outcome.comparable;

      /*
       * Ishod koji traži ljudsku odluku nije uspeh, ali nije ni greška
       * pošiljaoca: `409` kaže „primljeno, ne knjiži se samo“.
       */
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
          // Samo stabilan kod razloga; nikad polje ni vrednost iz dokumenta.
          reason: `Canonical ulaz odbijen: ${error.code}`,
        }).catch(() => {});
        return syncJson(422, { ok: false, code: error.code, requestId });
      }

      /*
       * Sve ostalo je greška servera. Poruka se NE prosleđuje: `Error.message`
       * iz drajvera ume da nosi deo upita, a stack trace putanje servera.
       */
      return syncJson(500, { ok: false, code: "ingest_failed", requestId });
    }
  });
}
