import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import type { LedgerScope } from "@/lib/ledger/effective-sales";

/**
 * Recommendation input — jedini dozvoljeni ulaz u cadence engine.
 *
 * Zašto ovde, a ne u `lib/recommendations`
 * ----------------------------------------
 * Ovo je nastavak ledger sloja, ne deo algoritma. `docs/b2b/17` traži da promet
 * ima JEDNO mesto sa kog se čita; paralelni sales ledger u drugom direktorijumu
 * bi bio druga istina, i prvo neslaganje bi se otkrilo tek pri poređenju sa
 * knjigovodstvom.
 *
 * Algoritam (`lib/recommendations/cadence.mjs`) NE zna za bazu i ne uvozi ovaj
 * modul. Ovaj modul ne zna za algoritam. Veza je samo tip `PurchaseEvent`.
 *
 * Šta je ovde zabranjeno
 * ----------------------
 * Nijedan upit iznad ovog sloja ne sme da gađa `invoices`, `invoice_lines`,
 * `source_document_lines` ni sirov PDF ingest. Sve prolazi kroz pogled
 * `recommendation_input_lines` (migracija 0026), čiji su uslovi dokazani
 * testom, ne dokumentacijom.
 */

/**
 * Osnov datuma, izričito zapisan.
 *
 * V1 koristi `issued_on` — datum izdavanja dokumenta. `trade_date` (datum
 * prometa) postoji u šemi ali je `null` za sve zatečeno i za sve što izvor ne
 * štampa, pa bi mešanje dva osnova značilo da su intervali računati nad dva
 * različita pojma vremena. Vrednost se upisuje uz svaki rezultat, da bi se
 * kasnija promena osnova videla kao promena, a ne kao ispravka.
 */
export const DATE_BASIS = "issued_on" as const;
export type DateBasis = typeof DATE_BASIS;

/**
 * Jedan KUPOVNI DOGAĐAJ: (kupac, artikal, poslovni dan).
 *
 * Ne jedan red fakture. Tri reda istog artikla na jednoj fakturi i dve fakture
 * istog kupca za isti artikal istog dana daju JEDAN događaj — inače bi jedna
 * isporuka razbijena na dva dokumenta izgledala kao interval od nula dana i
 * oborila svaku procenu ritma.
 */
export type PurchaseEvent = {
  customerId: string;
  /** EXACT BizniSoft šifra, sa vodećim nulama. Jedini identitet artikla. */
  articleCode: string;
  /** `YYYY-MM-DD`, bez vremena i bez zone. */
  issuedOn: string;
  /** Naziv sa poslednjeg dokumenta tog dana; prikaz, nikad identitet. */
  articleName: string;
  /** Koliko je stavki fakture ušlo u ovaj događaj — dijagnostika, ne količina. */
  lineCount: number;
  /** Dokazi koje čovek može da otvori; sortirani, radi determinizma. */
  invoiceIds: string[];
  sourceDocumentIds: string[];
};

/**
 * Uslov opsega nad `customer_id`.
 *
 * Namerno prekopiran obrazac iz `effective-sales.ts` i `data-readiness.ts`, sa
 * istim pravilom: `null` = bez ograničenja, prazan niz = IZRIČITO nijedan red.
 * Prazan niz se nikada ne sme prevesti u izostavljen uslov — to je bio nalaz
 * F-2 nad pricing ekranima.
 */
function uOpsegu(scope: LedgerScope): SQL {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  const lista = sql.join(
    scope.customerIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`customer_id IN (${lista})`;
}

/** `YYYY-MM-DD`; ništa drugo ne ulazi u upit. */
const DATUM = /^\d{4}-\d{2}-\d{2}$/;

export function assertAsOfDate(asOfDate: string): string {
  if (!DATUM.test(asOfDate)) {
    throw new Error(
      `asOfDate mora biti YYYY-MM-DD, dobijeno: ${JSON.stringify(asOfDate)}`,
    );
  }
  return asOfDate;
}

/**
 * Kupovni događaji u opsegu, zaključno sa `asOfDate`.
 *
 * `asOfDate` je OBAVEZAN i nikad se ne izvodi iz `new Date()`. Ceo lanac —
 * upit, matematika i zapis rezultata — mora da gleda isti dan, inače isti
 * recompute nad istim podacima daje dva različita rezultata i idempotentnost
 * postaje neproverljiva.
 *
 * Grupisanje radi BAZA. Vraćanje sirovih redova pa brojanje u JS-u bi nad
 * godinama prometa značilo desetine hiljada redova kroz memoriju servera za
 * posao koji `GROUP BY` radi na licu mesta.
 *
 * Sortiranje je potpuno određeno: (kupac, šifra, datum). Bez toga bi dva
 * prolaza nad istim podacima mogla da vrate isti skup u drugom redosledu, a
 * `asOfDate` i „isti rezultat bez obzira na ulazni redosled" ne bi bili
 * proverljivi.
 */
export async function purchaseEvents(
  scope: LedgerScope,
  input: { asOfDate: string; customerId?: string; articleCode?: string },
): Promise<PurchaseEvent[]> {
  const asOf = assertAsOfDate(input.asOfDate);
  const db = getDb();

  const uslovi: SQL[] = [uOpsegu(scope), sql`issued_on <= ${asOf}`];
  /*
   * Dodatno suženje NE PROŠIRUJE opseg — dodaje se uz njega, uvek `AND`.
   * Zato `customerId` iz zahteva ne može da dohvati tuđeg kupca: ako nije u
   * opsegu, presek je prazan.
   */
  if (input.customerId) uslovi.push(sql`customer_id = ${input.customerId}`);
  if (input.articleCode) uslovi.push(sql`article_code = ${input.articleCode}`);

  const redovi = await db.execute<{
    customer_id: string;
    article_code: string;
    issued_on: string;
    article_name: string;
    line_count: number;
    invoice_ids: string[];
    source_document_ids: string[];
  }>(sql`
    SELECT customer_id,
           article_code,
           issued_on::text                        AS issued_on,
           count(*)::int                          AS line_count,
           /*
            * Naziv sa POSLEDNJE stavke tog dana, po determinističkom redosledu.
            * max() bi uzeo abecedno najveći, što nije „poslednji" ni po čemu.
            */
           (array_agg(article_name ORDER BY invoice_id, line_number DESC))[1]
                                                  AS article_name,
           array_agg(DISTINCT invoice_id::text)   AS invoice_ids,
           array_agg(DISTINCT source_document_id::text)
                                                  AS source_document_ids
      FROM recommendation_input_lines
     WHERE ${sql.join(uslovi, sql` AND `)}
     GROUP BY customer_id, article_code, issued_on
     ORDER BY customer_id, article_code, issued_on
  `);

  return redovi.map((r) => ({
    customerId: r.customer_id,
    articleCode: r.article_code,
    issuedOn: String(r.issued_on).slice(0, 10),
    articleName: r.article_name,
    lineCount: r.line_count,
    // `array_agg(DISTINCT …)` već vraća sortirano, ali se ne oslanja na to.
    invoiceIds: [...r.invoice_ids].sort(),
    sourceDocumentIds: [...r.source_document_ids].sort(),
  }));
}

/* =========================================================================
 * Dijagnostika isključenja
 * ====================================================================== */

/**
 * Razlozi isključenja, u tačnom redosledu provere.
 *
 * Ladder je NAMERNO uređen i međusobno isključiv: jedan red dobija tačno jedan
 * razlog. Da su razlozi nezavisni, zbir bi bio veći od broja isključenih redova
 * i niko ne bi mogao da odgovori „koliko ih je zaista otpalo".
 *
 * Redosled ide od najgrublje odbrane ka najfinijoj: prvo da li dokument uopšte
 * postoji, pa da li mu se veruje, pa da li znamo čiji je, pa tek onda sadržaj
 * reda.
 */
export const EXCLUSION_REASONS = [
  "after_as_of_date",
  "no_source_document",
  "legacy_or_csv_origin",
  "validation_totals_mismatch",
  "validation_unparsable",
  "validation_unsupported_requires_sample",
  "revision_superseded",
  "revision_conflict",
  "revision_pending_review",
  "manual_review_pending",
  "customer_not_mapped",
  "document_not_positive_sale",
  "empty_article_code",
  "non_positive_line",
] as const;

export type ExclusionReason = (typeof EXCLUSION_REASONS)[number];

export type InputDiagnostics = {
  /** Redova koji su prošli sve uslove. */
  accepted: number;
  /** Redova odbijenih, po razlogu; ključevi su uvek svih 14, i kad su nula. */
  excluded: Record<ExclusionReason, number>;
  excludedTotal: number;
};

const PRAZNA: Record<ExclusionReason, number> = Object.fromEntries(
  EXCLUSION_REASONS.map((r) => [r, 0]),
) as Record<ExclusionReason, number>;

/**
 * Koliko redova je ušlo i zašto ostali nisu.
 *
 * Gađa `invoices`/`invoice_lines` NAMERNO i isključivo ovde: da bi se prebrojalo
 * šta je pogled odbacio, mora se videti i ono što pogled ne pušta. Ovo je
 * jedina funkcija u lancu koja ih dodiruje, ne vraća nijedan poslovni podatak
 * (samo brojače) i nikada se ne koristi kao ulaz u algoritam.
 *
 * Uslovi su prepisani iz migracije 0026 i test dokazuje da se ne razilaze:
 * `accepted` odavde mora biti jednak broju redova u pogledu.
 *
 * Tri `validation_*` razloga su DANAS strukturno nula
 * ---------------------------------------------------
 * `source_documents_invoice_needs_valid_ck` (migracija 0018) zabranjuje da
 * dokument koji nije `valid` uopšte dobije `invoice_id`, pa nevalidan dokument
 * nema nijednu stavku fakture i ne stiže dotle da bude odbijen ovde — on je
 * karantiniran ranije, bez ijednog reda prometa.
 *
 * Grane ipak stoje, i to nije mrtav kod: one su brojač koji bi PORASTAO da to
 * ograničenje ikad padne ili da se pojavi druga putanja knjiženja. Bez njih bi
 * takav dokument tiho ušao u preporuke, a jedini trag bila bi razlika u zbiru
 * koju niko ne gleda.
 */
export async function inputDiagnostics(
  scope: LedgerScope,
  input: { asOfDate: string },
): Promise<InputDiagnostics> {
  const asOf = assertAsOfDate(input.asOfDate);
  const db = getDb();

  const redovi = await db.execute<{ razlog: string | null; redova: number }>(sql`
    SELECT CASE
             WHEN i.issued_on > ${asOf}                     THEN 'after_as_of_date'
             WHEN sd.id IS NULL                             THEN 'no_source_document'
             WHEN sd.origin NOT IN ('manual_upload','device')
                                                            THEN 'legacy_or_csv_origin'
             WHEN sd.validation_status = 'totals_mismatch'  THEN 'validation_totals_mismatch'
             WHEN sd.validation_status = 'unparsable'       THEN 'validation_unparsable'
             WHEN sd.validation_status = 'unsupported_requires_sample'
                                                            THEN 'validation_unsupported_requires_sample'
             WHEN sd.revision_status = 'superseded'         THEN 'revision_superseded'
             WHEN sd.revision_status = 'conflict'           THEN 'revision_conflict'
             WHEN sd.revision_status = 'pending_review'     THEN 'revision_pending_review'
             WHEN sd.manual_review = 'pending'              THEN 'manual_review_pending'
             WHEN NOT EXISTS (
                    SELECT 1 FROM customer_external_identifiers cei
                     WHERE cei.source_system = 'biznisoft'
                       AND cei.issuer_code = sd.issuer_code
                       AND cei.external_partner_code = sd.external_partner_code
                       AND cei.customer_id = i.customer_id
                       AND cei.status = 'mapped'
                  )                                         THEN 'customer_not_mapped'
             WHEN i.document_kind <> 'faktura'               THEN 'document_not_positive_sale'
             WHEN btrim(il.article_code) = ''                THEN 'empty_article_code'
             WHEN il.quantity <= 0 OR il.line_amount < 0     THEN 'non_positive_line'
             ELSE NULL
           END                    AS razlog,
           count(*)::int          AS redova
      FROM invoices i
      JOIN invoice_lines il ON il.invoice_id = i.id
      LEFT JOIN source_documents sd ON sd.invoice_id = i.id
     WHERE ${uOpsegu(scope)}
     GROUP BY 1
  `);

  const excluded = { ...PRAZNA };
  let accepted = 0;
  let excludedTotal = 0;

  for (const red of redovi) {
    if (red.razlog === null) {
      accepted = red.redova;
      continue;
    }
    /*
     * Nepoznat razlog se NE guta.
     *
     * Da CASE ikada vrati vrednost koja nije na spisku, tiho ignorisanje bi
     * značilo da brojevi ne zbrajaju, a niko ne bi znao zašto.
     */
    if (!(red.razlog in excluded)) {
      throw new Error(`Nepoznat razlog isključenja: ${red.razlog}`);
    }
    excluded[red.razlog as ExclusionReason] = red.redova;
    excludedTotal += red.redova;
  }

  return { accepted, excluded, excludedTotal };
}
