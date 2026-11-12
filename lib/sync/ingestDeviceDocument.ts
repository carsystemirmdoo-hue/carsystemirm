import "server-only";
import { parseBiznisoftPdf } from "@/lib/pdf/extract";
import { ingestParsedDocument, type IngestActor, type IngestOutcome } from "@/lib/pdf/ingest";
import { ContractRejection } from "./contract/validate.mjs";

/**
 * Storno ili knjižno odobrenje sa uređaja kao PDF (2026-11-12).
 *
 * Server sam čita bajtove istim čitačem kao ručni upload, pa važe ista pravila: storno ne ulazi
 * u promet i vezuje se za original samo po odštampanoj referenci; knjižno odobrenje se knjiži
 * samo kada je čisto pročitano i kupac mapiran. Uređaj NE može ovim putem da pošalje fakturu:
 * vrsta koju server pročita mora biti ona koju je uređaj najavio, i mora biti jedna od dve.
 */
export async function ingestDeviceDocument(
  input: { kind: string; bytes: Uint8Array },
  trusted: { issuerCode: string; deviceId: string },
  actor: IngestActor,
): Promise<IngestOutcome> {
  const parsed = await parseBiznisoftPdf(input.bytes);
  if (parsed.documentKind !== input.kind) {
    throw new ContractRejection(
      "document_kind_mismatch",
      "Pročitana vrsta dokumenta ne odgovara najavljenoj; ovim putem idu samo storno i knjižno odobrenje.",
    );
  }
  return ingestParsedDocument(
    parsed,
    {
      // Bez naziva kupca i broja dokumenta: oznaka iz otiska je dovoljna da se dokument nađe.
      fileName: `uredjaj-${input.kind === "storno" ? "storno" : "odobrenje"}-${parsed.fileHash.slice(0, 12)}.pdf`,
      issuerCode: trusted.issuerCode,
      origin: "device",
      deliveredByDeviceId: trusted.deviceId,
    },
    actor,
  );
}
