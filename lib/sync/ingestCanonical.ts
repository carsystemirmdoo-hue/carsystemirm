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
  trusted: {
    issuerCode: string;
    runId?: number;
    /** Poreklo; `device` samo kada zahtev zaista dolazi sa uređaja. */
    origin?: "manual_upload" | "device";
    /** Uređaj koji je dostavio zapis — iz AUTENTIFIKACIJE, ne iz payloada. */
    deviceId?: string | null;
  },
  actor: IngestActor,
): Promise<IngestOutcome> {
  const { payload: proveren, semanticHash: verifikovan } = validateCanonicalInvoice(payload, {
    issuerCode: trusted.issuerCode,
  });

  const parsed = parsedDocumentFromCanonical(proveren) as ParsedDocument;

  return ingestParsedDocument(
    parsed,
    {
      /*
       * Ime fajla se NE prenosi kroz ugovor. Izvedena oznaka iz otiska je
       * dovoljna da se dokument pronađe, a ne nosi naziv kupca ni broj računa.
       *
       * Ovo je prikazna kompatibilnost sa `NOT NULL` kolonom, NE dokaz
       * porekla — poreklo ima svoje polje (`origin`) i dolazi ispod.
       */
      fileName: derivedFileName(proveren),
      issuerCode: trusted.issuerCode,
      runId: trusted.runId,

      origin: trusted.origin ?? "device",
      deliveredByDeviceId: trusted.deviceId ?? null,

      /*
       * Hash koji je SERVER ponovo izračunao, ne onaj iz payloada.
       *
       * `validateCanonicalInvoice` ga vraća upravo zato: dostavljena vrednost
       * je već upoređena i odbačena kao izvor. Prosleđivanje `proveren.semantic_hash`
       * bi radilo isto danas, ali bi sledeći čitalac pomislio da se veruje
       * pošiljaocu.
       */
      verifiedSemanticHash: verifikovan,
      canonicalizationVersion: proveren.canonicalization_version,
      schemaVersion: proveren.schema_version,

      /*
       * Valuta i njeno poreklo idu zajedno.
       *
       * `source_default`, jer čitač BizniSoft dokumenta valutu NE čita — RSD je
       * podrazumevana vrednost konfiguracije podržanog izvora. Zapisati
       * `document` ovde značilo bi tvrditi da je pročitana sa papira.
       */
      currency: proveren.document.currency,
      currencyProvenance: "source_default",
      tradeDate: proveren.document.trade_date,
      dateBasis: proveren.document.date_basis,
    },
    actor,
  );
}

export { ContractRejection };
