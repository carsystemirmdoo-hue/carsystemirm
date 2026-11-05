import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";

/**
 * Dokumenti koje su uređaji predali, po danu prijema.
 *
 * Prijem sa uređaja NE otvara `import_runs` (to je zapis ručnog uvoza), pa
 * „Poslednji uvozi“ sami ne govore ništa o automatskom toku. Ovo je isti
 * pogled iz `source_documents`: šta je stiglo, šta je proknjiženo i šta čeka
 * čoveka. Dan je dan PRIJEMA u Beogradu, ne datum dokumenta.
 */
export type DeliveryDay = {
  dan: string;
  stiglo: number;
  proknjizeno: number;
  cekaKupca: number;
  naPregledu: number;
  poslednjePrimljeno: string;
};

export const DELIVERY_DAYS_LIMIT = 10;

export async function dokumentiSaUredjajaPoDanu(): Promise<DeliveryDay[]> {
  const rows = await getDb().execute<{
    dan: string;
    stiglo: number;
    proknjizeno: number;
    ceka_kupca: number;
    na_pregledu: number;
    poslednje: string;
  }>(sql`
    SELECT to_char((created_at AT TIME ZONE 'Europe/Belgrade')::date, 'YYYY-MM-DD') AS dan,
           count(*)::int AS stiglo,
           count(*) FILTER (WHERE invoice_id IS NOT NULL)::int AS proknjizeno,
           count(*) FILTER (
             WHERE invoice_id IS NULL AND validation_status = 'valid'
               AND revision_status = 'original' AND manual_review <> 'pending'
           )::int AS ceka_kupca,
           count(*) FILTER (
             WHERE invoice_id IS NULL
               AND (validation_status <> 'valid' OR revision_status <> 'original'
                    OR manual_review = 'pending')
               AND NOT EXISTS (
                 SELECT 1 FROM invoice_reversals r
                  WHERE r.storno_source_document_id = source_documents.id
                    AND r.status = 'applied'
               )
           )::int AS na_pregledu,
           max(created_at)::text AS poslednje
      FROM source_documents
     WHERE origin = 'device'
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT ${DELIVERY_DAYS_LIMIT}
  `);
  return rows.map((r) => ({
    dan: r.dan,
    stiglo: r.stiglo,
    proknjizeno: r.proknjizeno,
    cekaKupca: r.ceka_kupca,
    naPregledu: r.na_pregledu,
    poslednjePrimljeno: r.poslednje,
  }));
}
