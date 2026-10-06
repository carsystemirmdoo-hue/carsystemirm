"use server";

import { requestRecomputeAfterIngest, scheduleRecomputeProcessing } from "@/lib/recommendations/auto-recompute";
import { revalidatePath } from "next/cache";
import { requireCapability } from "@/lib/authz/session";
import { fileHashOf } from "@/lib/pdf/extract";
import { ingestBiznisoftPdf, openIngestionRun } from "@/lib/pdf/ingest";
import {
  UPLOAD_PROCESSING_BUDGET_MS,
  uploadSelectionError,
} from "@/lib/import/upload-limits.mjs";

export type PdfImportState = {
  error: string | null;
  ok: string | null;
  /** Zbir po ishodima. Bez naziva fajlova i bez ijednog podatka o kupcu. */
  summary: { label: string; count: number }[];
};

/**
 * Granice otpremanja su u `lib/import/upload-limits.mjs` (telo zahteva,
 * veličina fajla, broj dokumenata, budžet vremena) — iste brojeve koriste
 * ekran i `next.config.ts`.
 *
 * Budžet vremena zaustavlja prolaz kada je posao već obavljen dovoljno,
 * umesto da server radi dok ga platforma ne prekine — a operater ostane bez
 * ijednog izveštaja. Prekid NIJE greška: sve što je do tada obrađeno je
 * proknjiženo i prijavljeno, a ostatak se otprema u sledećem prolazu.
 */
export async function importPdfAction(
  _previous: PdfImportState,
  formData: FormData,
): Promise<PdfImportState> {
  const user = await requireCapability("imports:write", "/portal/importi");

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
  // Ista provera kao na ekranu; server ne veruje klijentu.
  const selectionError = uploadSelectionError(files);
  if (selectionError) {
    return { error: selectionError, ok: null, summary: [] };
  }

  const actor = { id: user.id, name: user.name, role: user.role };
  const tally = new Map<string, number>();
  const bump = (key: string) => tally.set(key, (tally.get(key) ?? 0) + 1);

  const started = Date.now();
  let obradjeno = 0;

  for (const file of files) {
    if (Date.now() - started >= UPLOAD_PROCESSING_BUDGET_MS) {
      bump("prekinut_prolaz");
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
      // Storno se ne knjiži; ishod veze sa originalom je ono što operater treba da vidi (docs/b2b/48).
      bump(outcome.result === "quarantined" && outcome.reversal ? `storno_${outcome.reversal}` : outcome.result);
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
  storno_applied: "storno primenjen — original isključen iz prometa",
  storno_waiting_original: "storno sačuvan — čeka original",
  storno_review: "storno na ručnom pregledu — original ostaje u prometu",
  duplicate_file: "isti fajl, preskočeno",
  neuspelo_citanje: "nije pročitano — fajl odbijen",
  prekinut_prolaz: "nije obrađeno — budžet prolaza iscrpljen",
};
