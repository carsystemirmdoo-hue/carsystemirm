/**
 * Ručni CSV uvoz faktura je ISKLJUČEN (odluka 2026-10-01).
 *
 * Raspored kolona u `lib/import/invoiceRow.mjs` je naša pretpostavka izvedena
 * uz izmišljen fixture; nijedna kolona stvarnog BizniSoft izvoza nije
 * potvrđena (docs/b2b/03-data-contract-draft.md). Čita se i samo UTF-8.
 * Uvoz po pretpostavljenom rasporedu bi tiho pogrešno knjižio promet.
 *
 * Namerno konstanta u kodu, a ne promenljiva okruženja: uključivanje traži
 * izmenu parsera prema stvarnom uzorku, pregled i testove — ne prekidač.
 * PDF uvoz (dokazan na stvarnim primerima) nije pogođen.
 */
export const CSV_INVOICE_UPLOAD_ENABLED = false;

export const CSV_INVOICE_UPLOAD_DISABLED_MESSAGE =
  "CSV uvoz faktura je isključen dok ne stigne i ne proveri se stvarni uzorak BizniSoft izvoza. Fakture uvezite kao PDF.";
