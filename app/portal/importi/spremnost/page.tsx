import { Badge, Metric, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import {
  fakturePoKupcu,
  korektivni,
  mapiranjeArtikala,
  mapiranjeKupaca,
  parovi,
  poMesecima,
  problemiDokumenata,
  zbirniPregled,
} from "@/lib/readiness/data-readiness";
import {
  CSV_PDF_SUDAR,
  OGRADE,
  RASPON_NIJE_POTPUNOST,
  SEMANTIKA_DATUMA,
  statusLabela,
  nedostajuciDokazi,
  normalizujPeriod,
  oceniKriterijume,
  pokrivenost,
  pokrivenostTekst,
  problemiDokumenata as sloziProbleme,
  raspodelaFakturaPoKupcu,
} from "@/lib/readiness/dataReadiness.mjs";

export const dynamic = "force-dynamic";

/**
 * Spremnost podataka — interni, read-only dijagnostički pregled.
 *
 * Odgovara na jedno pitanje: ŠTA se stvarno zna o postojećim podacima. Ne
 * odgovara na „da li je vreme za preporuke“ i ne prikazuje nijedan predlog
 * kupovine, očekivanu porudžbinu, predviđenu količinu ni rejting kupca.
 *
 * Ovo NIJE javna strana i ne postoji u kupčevom portalu. Ovlašćenje je
 * `view:importi` — nasleđeno sa `/portal/importi` kroz `capabilityForPath`,
 * pošto je ovo podruta postojećeg prostora za importe. Namerno se NE uvodi
 * nova sposobnost: pregled je čitanje, a `documents:resolve` postoji za
 * odluke koje menjaju promet. Ovaj ekran ne menja ništa.
 *
 * Svaki upit ide kroz `LedgerScope` razrešen NA SERVERU iz sesije. Nijedan
 * parametar iz adrese ne dodiruje opseg — jedino što klijent bira je period.
 */
export default async function DataReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ od?: string; do?: string }>;
}) {
  const user = await requireCapability("view:importi", "/portal/importi/spremnost");
  const { od, do: doo } = await searchParams;

  const period = normalizujPeriod({ od, do: doo });

  /*
   * Opseg dolazi ISKLJUČIVO iz sesije.
   *
   * `resolveLedgerScope` vraća `{ customerIds: null }` samo za korisnika koji
   * sme da vidi sve kupce; svima ostalima vraća njihove dodele, i prazna
   * dodela je prazan niz — nikad `null`. Zato adresa ne može da proširi
   * pristup ni kada bi neko ručno dopisao parametar.
   */
  const scope = await resolveLedgerScope(user);
  const viditSve = seesAllCustomers(user);
  const opsegDostupan = scope.customerIds === null || scope.customerIds.length > 0;

  const [zbir, meseci, par, poKupcu, kupciMap, artikliMap, problemi, korekcije] =
    await Promise.all([
      zbirniPregled(scope, period),
      poMesecima(scope, period),
      parovi(scope, period),
      fakturePoKupcu(scope, period),
      mapiranjeKupaca(scope),
      mapiranjeArtikala(scope, period),
      problemiDokumenata(scope),
      korektivni(scope, period),
    ]);

  /*
   * Imenitelj se IMENUJE i razlikuje se po opsegu.
   *
   * Za komercijalistu su to šifre njegovih kupaca, ne sve uvezene šifre — a
   * ta razlika mora da stoji uz procenat, inače se isti broj čita kao tvrdnja
   * o celoj firmi.
   */
  const kupciPokrivenost = pokrivenost({
    ...kupciMap,
    imenitelj: viditSve
      ? "uvezene šifre partnera iz izvora"
      : "uvezene šifre partnera vaših kupaca",
  });
  const artikliPokrivenost = pokrivenost({
    ...artikliMap,
    imenitelj: "artikli koji se pojavljuju u efektivnoj prodaji u opsegu i periodu",
  });

  const kriterijumi = oceniKriterijume({
    efektivnihDokumenata: zbir.dokumenata,
    parovaSaViseFaktura: par.saViseFaktura,
    parovaSaViseDatuma: par.saViseDatuma,
    mapiranjeKupaca: kupciPokrivenost,
    mapiranjeArtikala: artikliPokrivenost,
    korektivnihDokumenata: korekcije.dokumenata,
    korektivnihBezVeze: korekcije.bezDokazaneVeze,
    opsegDostupan,
  });

  const dokazi = nedostajuciDokazi(kriterijumi);
  const raspodela = raspodelaFakturaPoKupcu(poKupcu);
  const pregledProblema = sloziProbleme(problemi);

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Spremnost podataka"
        description={
          "Šta se iz postojećih podataka može izmeriti, a šta ne. Ovo su dijagnostički brojevi — " +
          "nema predloga kupovine, očekivane porudžbine ni ocene kupca."
        }
        meta={<span>{SEMANTIKA_DATUMA}</span>}
      />

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <form className="portal-filters" method="get">
          <label className="portal-field">
            <span>Period od</span>
            <input type="date" name="od" defaultValue={period.od ?? ""} />
          </label>
          <label className="portal-field">
            <span>Period do</span>
            <input type="date" name="do" defaultValue={period.do ?? ""} />
          </label>
          <button type="submit" className="portal-button" data-variant="secondary">
            Primeni
          </button>
        </form>
        {period.greske.length > 0 ? (
          <ul className="portal-readiness-limits" data-tone="danger">
            {period.greske.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : null}
        <p className="portal-readiness-note">
          Prazan period znači „sve što je uvezeno“. Granice su uključive na oba kraja.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      {!opsegDostupan ? (
        <section className="portal-panel" data-accent="warning">
          <SectionHeader
            title="Vaš opseg je prazan"
            description={
              "Nemate nijednog dodeljenog kupca, pa su sve metrike nula NAD NULA KUPACA. " +
              "To nije tvrdnja o prometu firme — samo o tome šta vi smete da vidite."
            }
          />
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- */}
      <section className="portal-metrics">
        <Metric
          label="Efektivnih prodajnih dokumenata"
          value={String(zbir.dokumenata)}
          context="različitih faktura, ne stavki"
        />
        <Metric label="Stavki" value={String(zbir.stavki)} context="redova na tim fakturama" />
        <Metric label="Kupaca" value={String(zbir.kupaca)} context="sa bar jednom fakturom" />
        <Metric label="Artikala" value={String(zbir.artikala)} context="različitih šifri" />
        <Metric
          label="Parova kupac–artikal"
          value={String(par.ukupno)}
          context="različitih kombinacija"
        />
        <Metric
          label="Parova na ≥2 fakture"
          value={String(par.saViseFaktura)}
          context={`od toga na ≥2 različita datuma: ${par.saViseDatuma}`}
          tone="info"
        />
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Raspon uvezenih datuma"
          description={RASPON_NIJE_POTPUNOST}
        />
        <dl className="portal-definition-grid">
          <div>
            <dt>Najraniji dokument</dt>
            <dd>{zbir.najranije ?? "nema podataka"}</dd>
          </div>
          <div>
            <dt>Najkasniji dokument</dt>
            <dd>{zbir.najkasnije ?? "nema podataka"}</dd>
          </div>
        </dl>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Fakture po mesecu izdavanja"
          description="Mesec se računa iz datuma izdavanja dokumenta. Prikazano je najviše 120 najnovijih meseci."
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Mesec</th>
                <th scope="col">Faktura</th>
                <th scope="col">Stavki</th>
              </tr>
            </thead>
            <tbody>
              {meseci.map((m) => (
                <tr key={m.mesec}>
                  <th scope="row">{m.mesec}</th>
                  <td className="portal-table-number">{m.faktura}</td>
                  <td className="portal-table-number">{m.stavki}</td>
                </tr>
              ))}
              {meseci.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    Nema nijedne efektivne fakture u opsegu i periodu. To ne znači da
                    kupci nisu kupovali — znači da takav dokument nije uvezen.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Raspodela broja faktura po kupcu"
          description={
            "Koliko kupaca ima koliko različitih efektivnih faktura. Kante su samo grupisanje — " +
            "nijedna od njih nije ocena kupca niti prag spremnosti."
          }
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Broj faktura</th>
                <th scope="col">Kupaca</th>
              </tr>
            </thead>
            <tbody>
              {raspodela.map((k) => (
                <tr key={k.oznaka}>
                  <th scope="row">{k.oznaka}</th>
                  <td className="portal-table-number">{k.kupaca}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Mapiranja u poznatom uvezenom opsegu"
          description={
            "Procenat važi ISKLJUČIVO nad imenovanim imeniteljem ispod. Identitet koji nikada " +
            "nije uvezen se ovde ne broji ni kao mapiran ni kao nemapiran."
          }
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Šta se broji (imenitelj)</th>
                <th scope="col">Potvrđeno</th>
                <th scope="col">Nije potvrđeno</th>
                <th scope="col">Ukupno</th>
                <th scope="col">Pokrivenost</th>
              </tr>
            </thead>
            <tbody>
              {[
                { naslov: "Kupci", p: kupciPokrivenost },
                { naslov: "Artikli", p: artikliPokrivenost },
              ].map(({ naslov, p }) => (
                <tr key={naslov}>
                  <th scope="row">
                    {naslov}
                    <small>{p.imenitelj}</small>
                  </th>
                  <td className="portal-table-number">{p.potvrdjeno}</td>
                  <td className="portal-table-number">{p.nepotvrdjeno}</td>
                  <td className="portal-table-number">{p.ukupno}</td>
                  <td className="portal-table-number">{pokrivenostTekst(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="portal-readiness-note">
          Nulti imenitelj daje „nije dostupno“, ne 0% i ne 100%: nula od nule nije ni
          „ništa nije mapirano“ ni „sve je mapirano“.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Izvorni dokumenti koji čekaju odluku"
          description={pregledProblema.napomena}
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Kategorija</th>
                <th scope="col">Dokumenata</th>
              </tr>
            </thead>
            <tbody>
              {pregledProblema.kategorije.map((k) => (
                <tr key={k.kljuc}>
                  <th scope="row">{k.naslov}</th>
                  <td className="portal-table-number">{k.broj}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">
                  Ukupno različitih dokumenata
                  <small>jedini broj koji se sme čitati kao „koliko dokumenata“</small>
                </th>
                <td className="portal-table-number">{pregledProblema.ukupnoRazlicitih}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {pregledProblema.preklapaSe ? (
          <p className="portal-readiness-note" data-tone="warning">
            Kategorije se preklapaju: zbir kolone je veći od broja dokumenata jer isti
            dokument može biti u više njih.
          </p>
        ) : null}
        {!problemi.obuhvataNepripisive ? (
          <p className="portal-readiness-note">
            Brojevi obuhvataju samo dokumente koji su proknjiženi na vaše kupce. Dokument
            bez potvrđenog kupca nema opseg i namerno se ovde ne prikazuje — nemapiranost
            sama po sebi ne otvara vidljivost. Takve dokumente vidi kancelarija.
          </p>
        ) : null}
        <p className="portal-readiness-note">{CSV_PDF_SUDAR}</p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Korektivni dokumenti"
          description={
            "Povrat, storno, knjižno odobrenje i korekcije se vide u prometu, ali NE umanjuju " +
            "neto dok se veza sa originalom ne dokaže."
          }
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Šta</th>
                <th scope="col">Broj</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Poznatih korektivnih dokumenata</th>
                <td className="portal-table-number">{korekcije.dokumenata}</td>
              </tr>
              <tr>
                <th scope="row">Njihovih stavki</th>
                <td className="portal-table-number">{korekcije.stavki}</td>
              </tr>
              <tr>
                <th scope="row">Bez dokazane veze sa originalom</th>
                <td className="portal-table-number">{korekcije.bezDokazaneVeze}</td>
              </tr>
              <tr>
                <th scope="row">
                  Dokumenata kojima izvor ne daje vrstu
                  <small>bucket „unclassified“</small>
                </th>
                <td className="portal-table-number">{korekcije.nerazvrstanihDokumenata}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="portal-readiness-note">
          Nula uvezenih povrata NIJE dokaz da povrata nije bilo: format povrata još nema
          potvrđen uzorak, pa takav dokument ni ne bi bio pročitan.
        </p>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Kriterijumi spremnosti"
          description={
            "Svaki kriterijum nosi status, osnov dokaza i objašnjenje. Zbirnog „zelenog svetla“ " +
            "nema i neće ga biti — odluku donosi čovek nad spiskom nedostajućih dokaza."
          }
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Kriterijum</th>
                <th scope="col">Status</th>
                <th scope="col">Osnov</th>
                <th scope="col">Objašnjenje</th>
              </tr>
            </thead>
            <tbody>
              {kriterijumi.map((k) => (
                <tr key={k.kljuc}>
                  <th scope="row">{k.naslov}</th>
                  <td>
                    <Badge
                      tone={
                        k.status === "potvrdjeno"
                          ? "success"
                          : k.status === "nedostaje"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {statusLabela(k.status)}
                    </Badge>
                  </td>
                  <td>{k.osnov === "baza" ? "merljivo iz baze" : "spoljna evidencija"}</td>
                  <td>{k.objasnjenje}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Šta vlasnik treba da pribavi"
          description="Spisak prati stvarne statuse iznad; stavka koja se merljivo potvrdi ispada sama."
        />
        <div className="portal-table-wrap">
          <table className="portal-table portal-readiness-table">
            <thead>
              <tr>
                <th scope="col">Dokaz</th>
                <th scope="col">Zašto je potreban</th>
              </tr>
            </thead>
            <tbody>
              {dokazi.map((d) => (
                <tr key={d.kljuc}>
                  <th scope="row">{d.naslov}</th>
                  <td>{d.zasto}</td>
                </tr>
              ))}
              {dokazi.length === 0 ? (
                <tr>
                  <td colSpan={2}>Nijedan dokaz se ne traži.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      <section className="portal-panel">
        <SectionHeader
          title="Šta se iz ovih brojeva NE sme zaključiti"
          description="Ograde stoje uz ekran, a ne samo u dokumentaciji — ekran nadživi dokument koji ga objašnjava."
        />
        <ul className="portal-readiness-limits">
          {OGRADE.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
      </section>
    </>
  );
}
