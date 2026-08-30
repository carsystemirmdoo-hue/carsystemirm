import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  type LedgerScope,
} from "@/lib/ledger/effective-sales";

/**
 * Spremnost podataka — upiti.
 *
 * Read-only nad poslovnim podacima: ovde nema nijednog `INSERT`, `UPDATE` ni
 * `DELETE`, i nijedna nova tabela. Promet se čita ISKLJUČIVO kroz
 * `effective_sales_ledger` — isti pogled koji koristi i ostatak portala. Drugi
 * upit nad `invoices` bi bio druga istina, tačno onako kako
 * `docs/b2b/17-biznisoft-pdf-ledger.md` §1 zabranjuje.
 *
 * Sve se agregira U BAZI. Nijedna funkcija ne vraća istoriju da bi je JS
 * prebrojao: nad 3000 artikala i godinama prometa to bi značilo desetine hiljada
 * redova kroz memoriju servera za brojeve koje `count(*)` daje na licu mesta.
 *
 * Značenje brojeva je u `lib/readiness/dataReadiness.mjs`. Ovde su samo izvori.
 */

/* =========================================================================
 * Opseg
 * ====================================================================== */

/**
 * Uslov opsega nad kolonom `customer_id`.
 *
 * Namerno prekopiran obrazac iz `lib/ledger/effective-sales.ts`, a ne
 * izvezena zajednička funkcija: ovaj modul gađa i tabele koje ledger ne
 * dodiruje (`customer_external_identifiers`, `source_documents`), gde se
 * kolona zove drugačije i gde `null` opseg NE znači isto. Zajednička funkcija
 * bi to sakrila iza jednog imena.
 *
 * `null` = bez ograničenja. Prazan niz = NIJEDAN kupac, izričito `false`, nikad
 * izostavljen uslov.
 */
function uOpsegu(scope: LedgerScope, kolona: SQL = sql`customer_id`): SQL {
  if (scope.customerIds === null) return sql`true`;
  if (scope.customerIds.length === 0) return sql`false`;
  const lista = sql.join(
    scope.customerIds.map((id) => sql`${id}`),
    sql`, `,
  );
  return sql`${kolona} IN (${lista})`;
}

export type Period = { od: string | null; do: string | null };

/** Uslovi perioda nad `issued_on`; granice su uključive na oba kraja. */
function uPeriodu(period: Period): SQL[] {
  const uslovi: SQL[] = [];
  if (period.od) uslovi.push(sql`issued_on >= ${period.od}`);
  if (period.do) uslovi.push(sql`issued_on <= ${period.do}`);
  return uslovi;
}

/**
 * Uslov za EFEKTIVNU prodaju u opsegu i periodu.
 *
 * `enters_net` je jedini filter prodaje. Pogled je već izbacio duplikat,
 * zamenjenu reviziju i sporni dokument, pa se ovde ne ponavlja nijedno od tih
 * pravila — ponovljeno pravilo je pravilo koje se sledeći put razidje.
 */
function efektivnaProdaja(scope: LedgerScope, period: Period): SQL {
  return sql.join([uOpsegu(scope), sql`enters_net`, ...uPeriodu(period)], sql` AND `);
}

/* =========================================================================
 * Zbirni pregled
 * ====================================================================== */

export type ZbirniPregled = {
  /**
   * Različitih efektivnih prodajnih DOKUMENATA, ne stavki.
   *
   * `count(DISTINCT invoice_id)`: tri reda istog artikla na jednoj fakturi su
   * jedna kupovina. Bez `DISTINCT` bi dokument sa trinaest stavki izgledao kao
   * trinaest kupovina, i svaki naredni brojač bi nasledio tu grešku.
   */
  dokumenata: number;
  stavki: number;
  kupaca: number;
  artikala: number;
  najranije: string | null;
  najkasnije: string | null;
};

export async function zbirniPregled(
  scope: LedgerScope,
  period: Period,
): Promise<ZbirniPregled> {
  const db = getDb();
  const [red] = await db.execute<{
    dokumenata: number;
    stavki: number;
    kupaca: number;
    artikala: number;
    najranije: string | null;
    najkasnije: string | null;
  }>(sql`
    SELECT count(DISTINCT invoice_id)::int   AS dokumenata,
           count(*)::int                     AS stavki,
           count(DISTINCT customer_id)::int  AS kupaca,
           count(DISTINCT article_code)::int AS artikala,
           min(issued_on)::text              AS najranije,
           max(issued_on)::text              AS najkasnije
      FROM effective_sales_ledger
     WHERE ${efektivnaProdaja(scope, period)}
  `);

  return {
    dokumenata: red?.dokumenata ?? 0,
    stavki: red?.stavki ?? 0,
    kupaca: red?.kupaca ?? 0,
    artikala: red?.artikala ?? 0,
    najranije: red?.najranije ?? null,
    najkasnije: red?.najkasnije ?? null,
  };
}

/* =========================================================================
 * Po mesecima
 * ====================================================================== */

export type Mesec = { mesec: string; faktura: number; stavki: number };

/**
 * Broj faktura po mesecu izdavanja.
 *
 * Ograničeno na `limit` mesečnih redova. Bez granice bi jedan pogrešan datum
 * u izvoru (godina 1900 ili 2999) razvukao tabelu na hiljadu redova, a ekran
 * bi izgledao kao kvar umesto kao jedan loš podatak.
 */
export async function poMesecima(
  scope: LedgerScope,
  period: Period,
  limit = 120,
): Promise<Mesec[]> {
  const db = getDb();
  const redovi = await db.execute<{ mesec: string; faktura: number; stavki: number }>(sql`
    SELECT to_char(issued_on, 'YYYY-MM')    AS mesec,
           count(DISTINCT invoice_id)::int  AS faktura,
           count(*)::int                    AS stavki
      FROM effective_sales_ledger
     WHERE ${efektivnaProdaja(scope, period)}
     GROUP BY 1
     ORDER BY 1 DESC
     LIMIT ${limit}
  `);
  return redovi.map((r) => ({ mesec: r.mesec, faktura: r.faktura, stavki: r.stavki }));
}

/* =========================================================================
 * Parovi kupac–artikal
 * ====================================================================== */

export type Parovi = {
  /** Različitih kombinacija (kupac, artikal). */
  ukupno: number;
  /** Kombinacija na najmanje DVE različite efektivne fakture. */
  saViseFaktura: number;
  /** Kombinacija na najmanje DVA različita datuma izdavanja. */
  saViseDatuma: number;
};

/**
 * Ponavljanje para (kupac, artikal).
 *
 * `count(DISTINCT invoice_id)` i `count(DISTINCT issued_on)` su ovde suština,
 * ne stil. Tri reda istog artikla na jednoj fakturi daju jednu fakturu i jedan
 * datum — dakle NIJE ponovljena kupovina. Dve fakture istog dana daju dve
 * fakture ali jedan datum, pa se broje u `saViseFaktura` i NE u `saViseDatuma`;
 * ta razlika je jedini način da se vidi da li kupac zaista dolazi ponovo ili je
 * jedna isporuka razbijena na dva dokumenta.
 */
export async function parovi(scope: LedgerScope, period: Period): Promise<Parovi> {
  const db = getDb();
  const [red] = await db.execute<{
    ukupno: number;
    sa_vise_faktura: number;
    sa_vise_datuma: number;
  }>(sql`
    WITH po_paru AS (
      SELECT customer_id,
             article_code,
             count(DISTINCT invoice_id) AS faktura,
             count(DISTINCT issued_on)  AS datuma
        FROM effective_sales_ledger
       WHERE ${efektivnaProdaja(scope, period)}
       GROUP BY customer_id, article_code
    )
    SELECT count(*)::int                                AS ukupno,
           count(*) FILTER (WHERE faktura >= 2)::int    AS sa_vise_faktura,
           count(*) FILTER (WHERE datuma  >= 2)::int    AS sa_vise_datuma
      FROM po_paru
  `);
  return {
    ukupno: red?.ukupno ?? 0,
    saViseFaktura: red?.sa_vise_faktura ?? 0,
    saViseDatuma: red?.sa_vise_datuma ?? 0,
  };
}

/* =========================================================================
 * Raspodela po kupcu
 * ====================================================================== */

/** Koliko kupaca ima tačno N različitih efektivnih faktura. */
export async function fakturePoKupcu(
  scope: LedgerScope,
  period: Period,
  limit = 500,
): Promise<{ faktura: number; kupaca: number }[]> {
  const db = getDb();
  const redovi = await db.execute<{ faktura: number; kupaca: number }>(sql`
    WITH po_kupcu AS (
      SELECT customer_id, count(DISTINCT invoice_id) AS faktura
        FROM effective_sales_ledger
       WHERE ${efektivnaProdaja(scope, period)}
       GROUP BY customer_id
    )
    SELECT faktura::int, count(*)::int AS kupaca
      FROM po_kupcu
     GROUP BY faktura
     ORDER BY faktura
     LIMIT ${limit}
  `);
  return redovi.map((r) => ({ faktura: r.faktura, kupaca: r.kupaca }));
}

/* =========================================================================
 * Mapiranja
 * ====================================================================== */

export type BrojMapiranja = { potvrdjeno: number; ukupno: number };

/**
 * Mapiranje šifri partnera na kupce.
 *
 * IMENITELJ je broj UVEZENIH identiteta, nikad pretpostavljen broj svih kupaca
 * firme — sistem taj broj ne zna i ne sme da ga izmisli.
 *
 * Za korisnika sa ograničenim opsegom broje se samo identiteti već povezani sa
 * njegovim kupcima. Nemapirana šifra nema `customer_id` i zato ne pripada
 * nijednom opsegu; prikazati mu je značilo bi da nemapiranost sama po sebi
 * otvara vidljivost, što je suprotno od onoga što mapiranje čeka da odluči.
 */
export async function mapiranjeKupaca(scope: LedgerScope): Promise<BrojMapiranja> {
  const db = getDb();
  const [red] = await db.execute<{ potvrdjeno: number; ukupno: number }>(sql`
    SELECT count(*) FILTER (
             WHERE status = 'mapped' AND customer_id IS NOT NULL
           )::int AS potvrdjeno,
           count(*)::int AS ukupno
      FROM customer_external_identifiers
     WHERE ${uOpsegu(scope)}
  `);
  return { potvrdjeno: red?.potvrdjeno ?? 0, ukupno: red?.ukupno ?? 0 };
}

/**
 * Mapiranje artikala na katalog.
 *
 * Imenitelj su artikli KOJI SE POJAVLJUJU u efektivnoj prodaji u opsegu i
 * periodu — ne ceo registar artikala. Artikal koji nikada nije prodat nije
 * nedostatak mapiranja nego stavka bez prometa, i njegovo brojanje bi tiho
 * obaralo procenat bez ijedne posledice po podatke.
 *
 * `JOIN` ide samo na ŽIVE redove mapiranja. `article_catalog_mappings` dopušta
 * više `rejected`/`revoked` redova po artiklu (istorija predloga), pa bi bez
 * ovog uslova jedan artikal sa tri odbijena predloga ušao u imenitelj tri puta.
 */
export async function mapiranjeArtikala(
  scope: LedgerScope,
  period: Period,
): Promise<BrojMapiranja> {
  const db = getDb();
  const [red] = await db.execute<{ potvrdjeno: number; ukupno: number }>(sql`
    WITH u_prometu AS (
      SELECT DISTINCT article_id
        FROM effective_sales_ledger
       WHERE ${efektivnaProdaja(scope, period)}
         AND article_id IS NOT NULL
    )
    SELECT count(*) FILTER (WHERE m.status = 'mapped')::int AS potvrdjeno,
           count(*)::int                                    AS ukupno
      FROM u_prometu p
      LEFT JOIN article_catalog_mappings m
             ON m.article_id = p.article_id
            AND m.status NOT IN ('rejected', 'revoked')
  `);
  return { potvrdjeno: red?.potvrdjeno ?? 0, ukupno: red?.ukupno ?? 0 };
}

/* =========================================================================
 * Problemi izvornih dokumenata
 * ====================================================================== */

export type ProblemiDokumenata = {
  cekaMapiranje: number;
  sudar: number;
  rucniPregled: number;
  bezPodrskeZaFormat: number;
  ukupnoRazlicitih: number;
  /**
   * Da li brojevi uopšte pokrivaju nepripisive dokumente.
   *
   * `false` za korisnika sa ograničenim opsegom: dokument bez proknjižene
   * fakture nema kupca, pa ne pripada nijednom opsegu i NE ulazi u njegov zbir.
   */
  obuhvataNepripisive: boolean;
};

/**
 * Brojevi problema se čitaju iz `source_documents`, ODVOJENO od prometa.
 *
 * Izvorni dokument i faktura nisu isto: dokument koji nije prošao proveru
 * postoji, vidi se, i nema nijedan red prometa. Kada bi se problemi brojali iz
 * ledgera, upravo bi ti dokumenti — jedini koji su i problem — bili nevidljivi.
 *
 * Kategorije se PREKLAPAJU i ne smeju se sabirati: svaki dokument u sudaru je
 * ujedno i na ručnom pregledu, a `unsupported_requires_sample` je podskup
 * ručnog pregleda. Zato postoji `ukupnoRazlicitih`.
 *
 * Opseg: dokument se pripisuje kupcu ISKLJUČIVO preko proknjižene fakture.
 * Nepripisiv dokument (bez `invoice_id`) vidi se samo korisniku koji ionako
 * vidi sve kupce — postojeća kancelarijska/gazdinska politika. Za ostale se
 * izostavlja, a `obuhvataNepripisive` to izričito kaže umesto da ekran ćuti.
 */
export async function problemiDokumenata(
  scope: LedgerScope,
): Promise<ProblemiDokumenata> {
  const db = getDb();
  const globalno = scope.customerIds === null;

  /*
   * Pripisivost. Za neograničen opseg — svi dokumenti. Za ograničen — samo oni
   * čija faktura pripada kupcu u opsegu; `EXISTS`, ne `JOIN`, da dokument ne bi
   * mogao da se pojavi dvaput.
   */
  const pripada = globalno
    ? sql`true`
    : sql`EXISTS (
          SELECT 1 FROM invoices i
           WHERE i.id = sd.invoice_id
             AND ${uOpsegu(scope, sql`i.customer_id`)}
        )`;

  const cekaMapiranje = sql`sd.invoice_id IS NULL
                            AND sd.validation_status = 'valid'
                            AND sd.revision_status = 'original'`;
  const sudar = sql`sd.revision_status = 'conflict'`;
  const rucni = sql`sd.manual_review = 'pending'`;
  const bezPodrske = sql`sd.validation_status = 'unsupported_requires_sample'`;

  const [red] = await db.execute<{
    ceka_mapiranje: number;
    sudar: number;
    rucni_pregled: number;
    bez_podrske: number;
    ukupno_razlicitih: number;
  }>(sql`
    SELECT count(*) FILTER (WHERE ${cekaMapiranje})::int AS ceka_mapiranje,
           count(*) FILTER (WHERE ${sudar})::int         AS sudar,
           count(*) FILTER (WHERE ${rucni})::int         AS rucni_pregled,
           count(*) FILTER (WHERE ${bezPodrske})::int    AS bez_podrske,
           count(*) FILTER (
             WHERE (${cekaMapiranje}) OR (${sudar}) OR (${rucni}) OR (${bezPodrske})
           )::int AS ukupno_razlicitih
      FROM source_documents sd
     WHERE ${pripada}
  `);

  return {
    cekaMapiranje: red?.ceka_mapiranje ?? 0,
    sudar: red?.sudar ?? 0,
    rucniPregled: red?.rucni_pregled ?? 0,
    bezPodrskeZaFormat: red?.bez_podrske ?? 0,
    ukupnoRazlicitih: red?.ukupno_razlicitih ?? 0,
    obuhvataNepripisive: globalno,
  };
}

/* =========================================================================
 * Korektivni dokumenti
 * ====================================================================== */

export type Korektivni = {
  /** Poznatih korektivnih dokumenata (povrat, storno, knjižno odobrenje, korekcije). */
  dokumenata: number;
  stavki: number;
  /** Od toga bez dokazane veze sa originalom — danas svi. */
  bezDokazaneVeze: number;
  /** Dokumenti kojima izvor uopšte ne daje vrstu. */
  nerazvrstanihDokumenata: number;
};

/**
 * Korektivni dokumenti u prometu.
 *
 * `bezDokazaneVeze` je danas JEDNAK ukupnom broju i to nije previd: kolona za
 * vezu sa originalom ne postoji, jer nijedan stvaran uzorak još ne pokazuje
 * kako se referenca na original zapisuje (vidi `docs/b2b/17` §10). Dok je tako,
 * nijedan korektivni dokument ne umanjuje neto promet.
 *
 * Vrednost se čita iz istog izraza umesto da bude prepisana konstanta, da bi
 * dan kada veza postane dokaziva promenio broj sam od sebe.
 */
export async function korektivni(
  scope: LedgerScope,
  period: Period,
): Promise<Korektivni> {
  const db = getDb();
  const uslov = sql.join([uOpsegu(scope), ...uPeriodu(period)], sql` AND `);

  const [red] = await db.execute<{
    dokumenata: number;
    stavki: number;
    bez_veze: number;
    nerazvrstanih: number;
  }>(sql`
    SELECT count(DISTINCT invoice_id) FILTER (
             WHERE NOT enters_net AND bucket <> 'unclassified'
           )::int AS dokumenata,
           count(*) FILTER (
             WHERE NOT enters_net AND bucket <> 'unclassified'
           )::int AS stavki,
           /*
            * Veza sa originalom se nigde ne čuva, pa je „bez dokazane veze"
            * ceo skup. Izraz, ne konstanta: kada kolona bude postojala, ovde
            * se dodaje uslov i broj se razlikuje bez ijedne izmene ekrana.
            */
           count(DISTINCT invoice_id) FILTER (
             WHERE NOT enters_net AND bucket <> 'unclassified'
           )::int AS bez_veze,
           count(DISTINCT invoice_id) FILTER (
             WHERE bucket = 'unclassified'
           )::int AS nerazvrstanih
      FROM effective_sales_ledger
     WHERE ${uslov}
  `);

  return {
    dokumenata: red?.dokumenata ?? 0,
    stavki: red?.stavki ?? 0,
    bezDokazaneVeze: red?.bez_veze ?? 0,
    nerazvrstanihDokumenata: red?.nerazvrstanih ?? 0,
  };
}
