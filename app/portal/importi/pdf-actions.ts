"use server";

import { requestRecomputeAfterIngest, scheduleRecomputeProcessing } from "@/lib/recommendations/auto-recompute";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { fileHashOf } from "@/lib/pdf/extract";
import { ingestBiznisoftPdf, openIngestionRun } from "@/lib/pdf/ingest";

export type PdfImportState = {
  error: string | null;
  ok: string | null;
  /** Zbir po ishodima. Bez naziva fajlova i bez ijednog podatka o kupcu. */
  summary: { label: string; count: number }[];
};

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 200;

/**
 * Budžet jednog prolaza.
 *
 * Broj fajlova sam po sebi ne ograničava posao: dvesta fajlova po dvadeset
 * megabajta je četiri gigabajta čitanja u jednoj akciji. Ova dva broja
 * zaustavljaju prolaz kada je posao već obavljen dovoljno, umesto da server
 * radi dok ga platforma ne prekine — a operater ostane bez ijednog izveštaja.
 *
 * Prekid NIJE greška: sve što je do tada obrađeno je proknjiženo i prijavljeno,
 * a ostatak se otprema u sledećem prolazu.
 */
const MAX_BATCH_BYTES = 200 * 1024 * 1024;
const MAX_BATCH_MS = 90 * 1000;

export async function importPdfAction(
  _previous: PdfImportState,
  formData: FormData,
): Promise<PdfImportState> {
  const user = await requireCapability("view:importi", "/portal/importi");

  const issuerCode = String(formData.get("izdavalac") || "").trim();
  if (!issuerCode) {
    return { error: "Unesite oznaku izdavaoca.", ok: null, summary: [] };
  }

  const files = formData
    .getAll("fajlovi")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    return { error: "Izaberite bar jedan PDF.", ok: null, summary: [] };
  }
  if (files.length > MAX_FILES) {
    return {
      error: `Najviše ${MAX_FILES} dokumenata po prolazu.`,
      ok: null,
      summary: [],
    };
  }

  const actor = { id: user.id, name: user.name, role: user.role };
  const tally = new Map<string, number>();
  const bump = (key: string) => tally.set(key, (tally.get(key) ?? 0) + 1);

  const started = Date.now();
  let bytesRead = 0;
  let obradjeno = 0;

  for (const file of files) {
    if (bytesRead >= MAX_BATCH_BYTES || Date.now() - started >= MAX_BATCH_MS) {
      bump("prekinut_prolaz");
      continue;
    }
    if (file.size > MAX_BYTES) {
      bump("prevelik_fajl");
      continue;
    }

    /*
     * Svaki fajl se obrađuje IZOLOVANO.
     *
     * Jedan neispravan, šifrovan ili skraćen PDF ne sme oboriti ceo prolaz:
     * bez ovoga je devetnaest uspešno uvezenih dokumenata nestajalo iz
     * izveštaja zajedno sa dvadesetim koji je pukao, i operater nije imao
     * način da sazna šta je prošlo.
     */
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      bytesRead += bytes.byteLength;
      obradjeno += 1;

      /*
       * Prolaz se otvara po fajlu, ne po otpremanju.
       *
       * Tako `import_runs` i dalje nosi otisak konkretnog dokumenta i ostaje
       * idempotentan, umesto da jedan prolaz „pokrije" dvadeset fajlova od
       * kojih je polovina već uvezena.
       */
      const runId = await openIngestionRun(
        { fileName: file.name, fileHash: fileHashOf(bytes) },
        actor,
      );

      const outcome = await ingestBiznisoftPdf(
        { bytes, fileName: file.name, issuerCode, runId: runId ?? undefined },
        actor,
      );
      bump(outcome.result);
    } catch {
      /*
       * Greška se NE prosleđuje dalje ni u kom obliku.
       *
       * Poruka čitača ume da sadrži deo teksta dokumenta, a stack trace odaje
       * putanje servera. Ekran dobija samo brojku; sam dokument nije nastao,
       * pa nema ni šta da se pregleda.
       */
      bump("neuspelo_citanje");
    }
  }

  revalidatePath("/portal/importi");
  revalidatePath("/portal/importi/dokumenti");

  // Uspešno proknjiženi dokumenti → automatski obračun preporuka (ako je uključen).
  const posted = tally.get("ingested") ?? 0;
  if (posted > 0) {
    await requestRecomputeAfterIngest("manual_upload", posted).catch(() => undefined);
    scheduleRecomputeProcessing();
  }

  const summary = [...tally.entries()].map(([key, count]) => ({
    label: OUTCOME_LABELS[key] ?? key,
    count,
  }));

  return {
    error: null,
    ok: `Obrađeno dokumenata: ${obradjeno} od ${files.length}.`,
    summary,
  };
}

const OUTCOME_LABELS: Record<string, string> = {
  ingested: "proknjiženo",
  awaiting_customer_mapping: "čeka mapiranje kupca",
  business_key_conflict: "sudar sa postojećim dokumentom",
  already_imported_other_source: "već knjiženo iz drugog izvora — traži pregled",
  quarantined: "karantin — traži pregled",
  duplicate_file: "isti fajl, preskočeno",
  prevelik_fajl: "odbijeno, prevelik fajl",
  neuspelo_citanje: "nije pročitano — fajl odbijen",
  prekinut_prolaz: "nije obrađeno — budžet prolaza iscrpljen",
};
