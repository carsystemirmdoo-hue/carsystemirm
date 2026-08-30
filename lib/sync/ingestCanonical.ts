import "server-only";
import {
  ingestParsedDocument,
  type IngestActor,
  type IngestOutcome,
} from "@/lib/pdf/ingest";
import type { ParsedDocument } from "@/lib/pdf/extract";
import { derivedFileName, parsedDocumentFromCanonical } from "./contract/toParsedDocument.mjs";
import { ContractRejection, validateCanonicalInvoice } from "./contract/validate.mjs";

/**
 * Serverski ulaz za canonical (JSON) dokument.
 *
 * Redosled je obavezan i nije stvar stila:
 *
 *   1. `validateCanonicalInvoice` — oblik, verzije, opseg, podržani podskup,
 *      datumi, decimale, NEZAVISNA provera iznosa i ponovo izračunat
 *      `semantic_hash`;
 *   2. adapter u oblik koji servis već ume da knjiži;
 *   3. `ingestParsedDocument` — isti transakcioni servis koji koristi i ručni
 *      PDF upload.
 *
 * Nijedan nevalidan ulaz ne stiže do koraka 3, pa ne ostavlja ni izvorni
 * dokument, ni stavke, ni promet.
 *
 * Ovo NIJE ruta i NIJE server action. Funkcija ne proverava nijednu dozvolu —
 * pozivalac mora već biti autorizovan, isto kao kod `ingestParsedDocument`.
 * U P1 je pozivaju samo testovi; mrežni ulaz i uređaji su P2.
 *
 * `issuerCode` dolazi iz POUZDANOG serverskog konteksta. Payload nosi svoj
 * `issuer.code`, ali on se samo POREDI — sadržaj koji sam sebi dodeli opseg
 * nije opseg.
 */
export async function ingestCanonicalInvoice(
  payload: unknown,
  trusted: { issuerCode: string; runId?: number },
  actor: IngestActor,
): Promise<IngestOutcome> {
  const { payload: proveren } = validateCanonicalInvoice(payload, {
    issuerCode: trusted.issuerCode,
  });

  const parsed = parsedDocumentFromCanonical(proveren) as ParsedDocument;

  return ingestParsedDocument(
    parsed,
    {
      /*
       * Ime fajla se NE prenosi kroz ugovor. Izvedena oznaka iz otiska je
       * dovoljna da se dokument pronađe, a ne nosi naziv kupca ni broj računa.
       */
      fileName: derivedFileName(proveren),
      issuerCode: trusted.issuerCode,
      runId: trusted.runId,
    },
    actor,
  );
}

export { ContractRejection };
