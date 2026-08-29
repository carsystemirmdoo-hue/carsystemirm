"use server";

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
 * Otpremanje BizniSoft PDF-ova.
 *
 * Fajl se čita u memoriji i NE snima se na server: sadržaj je poslovna
 * prepiska sa imenom, PIB-om i adresom kupca, a sve što sistemu treba posle
 * uvoza već stoji u `source_documents` i `source_document_lines`. Otisak
 * sadržaja ostaje, pa se ponovni uvoz i dalje prepoznaje.
 */
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
  let refused = 0;

  for (const file of files) {
    if (file.size > MAX_BYTES) {
      refused += 1;
      continue;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());

    /*
     * Prolaz se otvara po fajlu, ne po otpremanju.
     *
     * Tako `import_runs` i dalje nosi otisak konkretnog dokumenta i ostaje
     * idempotentan, umesto da jedan prolaz „pokrije" dvadeset fajlova od kojih
     * je polovina već uvezena.
     */
    const runId = await openIngestionRun(
      { fileName: file.name, fileHash: fileHashOf(bytes) },
      actor,
    );

    const outcome = await ingestBiznisoftPdf(
      { bytes, fileName: file.name, issuerCode, runId: runId ?? undefined },
      actor,
    );
    tally.set(outcome.result, (tally.get(outcome.result) ?? 0) + 1);
  }

  if (refused > 0) tally.set("prevelik_fajl", refused);

  revalidatePath("/portal/importi");
  revalidatePath("/portal/importi/dokumenti");

  const summary = [...tally.entries()].map(([key, count]) => ({
    label: OUTCOME_LABELS[key] ?? key,
    count,
  }));

  return {
    error: null,
    ok: `Obrađeno dokumenata: ${files.length}.`,
    summary,
  };
}

const OUTCOME_LABELS: Record<string, string> = {
  ingested: "proknjiženo",
  awaiting_customer_mapping: "čeka mapiranje kupca",
  business_key_conflict: "sudar sa postojećim dokumentom",
  quarantined: "karantin — traži pregled",
  duplicate_file: "isti fajl, preskočeno",
  prevelik_fajl: "odbijeno, prevelik fajl",
};
