import { sql, type SQL } from "drizzle-orm";
import { invoices } from "@/db/schema";

/**
 * Faktura sme u promet: isti uslov kao `WHERE` u pogledu
 * `effective_sales_ledger` (migracija 0019), izražen nad tabelom `invoices`.
 *
 * Faktura bez izvornog dokumenta (raniji CSV uvoz) je legitimna. Faktura sa
 * izvornim dokumentom ulazi samo ako je taj dokument original i nije na
 * ručnom pregledu — zamenjena revizija, sudar i dokument koji čeka odluku ne
 * ulaze. Migracija 0022 dozvoljava najviše jedan izvorni dokument po fakturi,
 * pa je `NOT EXISTS` ekvivalentan `LEFT JOIN`-u iz pogleda.
 *
 * Ekrani prometa (`/portal/prodaja`, `/portal/analitika`, `/portal/kupci`,
 * `/portal/povrati`) su do sada čitali `invoices` direktno i brojali i
 * sporne dokumente; preporuke i spremnost podataka su čitali pogled. Sada
 * svi koriste isto pravilo.
 */
export function effectiveInvoiceCondition(): SQL {
  return sql`NOT EXISTS (
    SELECT 1 FROM source_documents sd
     WHERE sd.invoice_id = ${invoices.id}
       AND NOT (sd.revision_status = 'original' AND sd.manual_review <> 'pending')
  )`;
}
