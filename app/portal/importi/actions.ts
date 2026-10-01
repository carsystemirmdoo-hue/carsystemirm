"use server";

import { revalidatePath } from "next/cache";
import {
  importInvoiceFile,
  parseDelimited,
} from "@/lib/import/invoiceImport";
import { requireCapability } from "@/lib/authz/session";
import { formatMegabytes, MAX_UPLOAD_FILE_BYTES } from "@/lib/import/upload-limits.mjs";

export type ImportState = {
  error: string | null;
  ok: string | null;
  detail: string | null;
};

/**
 * Ručni uvoz jednog izvoznog fajla.
 *
 * Do automatskog konektora (koji čita folder na računaru u kancelariji) ovo je
 * put kojim podaci ulaze u sistem. Idempotentnost je ista u oba slučaja:
 * isti fajl se prepoznaje po otisku i preskače.
 */
export async function importFileAction(
  _previous: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireCapability("imports:write", "/portal/importi");

  const file = formData.get("fajl");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Izaberite fajl za uvoz.", ok: null, detail: null };
  }
  if (file.size > MAX_UPLOAD_FILE_BYTES) {
    return {
      error: `Fajl je veći od ${formatMegabytes(MAX_UPLOAD_FILE_BYTES)}.`,
      ok: null,
      detail: null,
    };
  }

  const content = await file.text();
  const rows = parseDelimited(content);
  if (rows.length === 0) {
    return {
      error: "Fajl nema nijedan red sa podacima.",
      ok: null,
      detail: null,
    };
  }

  const outcome = await importInvoiceFile(
    {
      fileName: file.name,
      sourcePath: "ručni uvoz",
      content,
      rows,
      dataDate: String(formData.get("datum_podataka") || "") || null,
    },
    user,
  );

  revalidatePath("/portal/importi");

  const detail = [
    `pročitano ${outcome.rowsRead}`,
    `ispravno ${outcome.rowsValid}`,
    `upozorenja ${outcome.rowsWarning}`,
    `greške ${outcome.rowsInvalid}`,
    `nove fakture ${outcome.invoicesCreated}`,
    `ažurirane ${outcome.invoicesUpdated}`,
  ].join(" · ");

  if (outcome.status === "preskoceno_duplikat") {
    return { error: null, ok: outcome.message, detail: null };
  }
  if (outcome.status === "greska") {
    return { error: outcome.message, ok: null, detail };
  }
  return { error: null, ok: outcome.message, detail };
}
