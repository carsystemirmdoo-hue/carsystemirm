import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, PageHeader, PortalLinkButton, SectionHeader } from "@/components/portal/PortalPrimitives";
import { ClanakUrednik, type Izvor } from "@/features/portal/clanci/ClanakUrednik";
import {
  ObjaviOdmah,
  Odobri,
  OtkaziTermin,
  OznaciStrucnu,
  PosaljiNaPregled,
  Povuci,
  PregledOkvir,
  StrucnaPotvrda,
  VratiNaDoradu,
  VratiVerziju,
  Zakazi,
} from "@/features/portal/clanci/ClanakRadnje";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { SAVETI_KATEGORIJE } from "@/lib/saveti/kategorije.mjs";
import { clanakZaUredjivanje, imenaKorisnika, TIP_LABEL } from "@/lib/saveti/urednik/servis";
import { datumSrbije, RADNJA_LABEL, STATUS_LABEL, STATUS_TONE, vremeSrbije } from "@/lib/saveti/urednik/stanje.mjs";

export const metadata = { title: "Članak" };
export const dynamic = "force-dynamic";

type Tone = "info" | "success" | "neutral" | "warning" | "danger";
type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ ishod?: string }> };

const ISHOD: Record<string, string> = {
  sacuvano: "Sačuvana je nova verzija. Ako je članak bio odobren, nova verzija traži novo odobrenje.",
  "sacuvano-napomene": "Sačuvane su interne napomene. Javni sadržaj je isti, pa odobrenje i dalje važi.",
  "na-pregledu": "Članak je poslat na pregled.",
  dorada: "Članak je vraćen na doradu.",
  odobreno: "Verzija je odobrena.",
  zakazano: "Objava je zakazana. Članak postaje javan u izabrano vreme (najkasnije minut kasnije).",
  otkazano: "Termin je otkazan.",
  objavljeno: "Članak je objavljen na sajtu.",
  "strucna-potvrda": "Stručna potvrda je upisana za ovu verziju. Sada je verzija spremna za odobrenje.",
  "oznaceno-strucna": "Tekst je označen kao tekst koji traži stručnu potvrdu.",
  povuceno: "Članak je povučen iz javnog prikaza.",
  "vracena-verzija": "Napravljena je nova verzija sa sadržajem ranije verzije. Za objavu je potrebno novo odobrenje.",
};

const OBJASNJENJE: Record<string, string> = {
  nacrt: "Nacrt se može menjati i čuvati. Kada je spreman, pošaljite ga na pregled.",
  za_pregled: "Čeka odobrenje vlasnika. Pročitajte verziju u pregledu ispod, pa je odobrite ili vratite na doradu.",
  odobren: "Ova verzija je odobrena. Zakažite datum i vreme objave (vreme Srbije) ili je objavite odmah.",
  zakazan: "Zakazana verzija postaje javna u izabrano vreme. Svaka izmena teksta ili slike otkazuje termin i traži novo odobrenje.",
  objavljen: "Članak je javan. Izmene se čuvaju kao radna verzija; javni tekst ostaje odobrena verzija dok nova ne bude odobrena i objavljena.",
  povucen: "Članak nije javan (povučen). Verzije i istorija ostaju sačuvani; izmenjen i ponovo odobren tekst može se ponovo objaviti.",
};

export default async function ClanakPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { ishod } = await searchParams;
  const actor = await requireCapability("view:clanci", "/portal/clanci");
  const data = await clanakZaUredjivanje(actor, decodeURIComponent(id));
  if (!data) notFound();
  const { clanak, verzije, dogadjaji, objave, stanje } = data;
  const danas = datumSrbije(new Date());
  const strucna = stanje.strucnaPotvrda;
  const strucnaDet = (strucna.vazeca?.detalji ?? null) as Record<string, string> | null;
  const last = verzije[verzije.length - 1];
  const javna = verzije.find((v) => v.id === stanje.javnaVerzijaId) ?? null;
  const imena = await imenaKorisnika([...new Set(verzije.map((v) => v.napravio).filter((x): x is string => Boolean(x)))]);
  const smeEdit = can(actor, "articles:edit");
  const smeApprove = can(actor, "articles:approve");
  const smePublish = can(actor, "articles:publish");
  const radni = stanje.radniStatus;
  const kategorija = SAVETI_KATEGORIJE.find((k: { slug: string }) => k.slug === clanak.kategorija) as { naziv: string } | undefined;
  const odobrenaVerzijaId = stanje.odobrenje?.verzijaId ?? null;
  const pregledSrc = `/vodici/pregled/${last.id}`;
  const izvori = (Array.isArray(last.izvori) ? last.izvori : []) as Izvor[];
  const slika = last.slikaId ? { id: last.slikaId, alt: last.slikaAlt, sirina: 0, visina: 0 } : null;

  return (
    <>
      <PageHeader
        eyebrow={`Sadržaj · Članci · ${clanak.id}`}
        title={last.naslov}
        description={`${TIP_LABEL[clanak.tip] ?? clanak.tip} · ${kategorija?.naziv ?? clanak.kategorija} · verzija ${last.broj}`}
        meta={
          <span className="cl-badges">
            <Badge tone={(STATUS_TONE[stanje.status] ?? "neutral") as Tone}>{STATUS_LABEL[stanje.status]}</Badge>
            {stanje.imaIzmene ? (
              <>
                {" "}
                <Badge tone={(STATUS_TONE[radni] ?? "neutral") as Tone}>izmene: {STATUS_LABEL[radni]}</Badge>
              </>
            ) : null}
            {stanje.termin ? <> · zakazano {vremeSrbije(stanje.termin)}</> : null}
            {stanje.javno ? (
              <>
                {" "}
                · <Link href={`/vodici/${clanak.slug}`} target="_blank">javna adresa /vodici/{clanak.slug}</Link>
              </>
            ) : null}
          </span>
        }
        actions={<PortalLinkButton href="/portal/clanci" variant="ghost">Svi članci</PortalLinkButton>}
      />

      {ishod && ISHOD[ishod] ? (
        <p className="portal-permission-ok cl-notice" role="status">
          {ISHOD[ishod]}
        </p>
      ) : null}

      <section className="portal-panel" data-accent={stanje.status === "za_pregled" || radni === "za_pregled" ? "warning" : undefined}>
        <SectionHeader title="Stanje i sledeći korak" description={OBJASNJENJE[stanje.imaIzmene ? radni : stanje.status] ?? ""} />
        <div className="portal-panel-body cl-actions">
          {last.nepotvrdjeno.trim() ? (
            <div className="cl-warning" role="note">
              <strong>Nepotvrđene tehničke tvrdnje</strong>
              <p>{last.nepotvrdjeno}</p>
            </div>
          ) : null}
          {strucna.potrebna ? (
            <div className={strucna.vazeca ? "cl-expert-ok" : "cl-warning"} role="note">
              <strong>{strucna.vazeca ? "Stručna potvrda upisana" : "Traži stručnu potvrdu pre odobrenja"}</strong>
              {clanak.strucnaPotvrdaRazlog ? <p>{clanak.strucnaPotvrdaRazlog}</p> : null}
              {strucnaDet ? (
                <p>
                  Potvrdio/la {strucnaDet.strucnjak} ({strucnaDet.uloga}), {strucnaDet.datum}: {strucnaDet.obuhvat}
                </p>
              ) : (
                <p className="cl-sub">Urednička provera i odobrenje vlasnika ne zamenjuju stručnu potvrdu. Svaka izmena teksta traži novu potvrdu.</p>
              )}
            </div>
          ) : null}

          {clanak.povuceno && !stanje.javno ? (
            <p>
              Povučeno {vremeSrbije(clanak.povuceno)}. Razlog: {clanak.povucenRazlog}
            </p>
          ) : null}
          <div className="cl-action-row">
            {radni === "nacrt" && smeEdit ? <PosaljiNaPregled id={clanak.id} /> : null}
            {radni === "za_pregled" && smeApprove && strucna.potrebna && !strucna.vazeca ? (
              <StrucnaPotvrda id={clanak.id} verzija={last.broj} danas={danas} />
            ) : null}
            {radni === "za_pregled" && smeApprove && (!strucna.potrebna || strucna.vazeca) ? (
              <Odobri id={clanak.id} verzija={last.broj} izmene={stanje.imaIzmene} />
            ) : null}
            {["za_pregled", "odobren", "zakazan"].includes(radni) && smeApprove ? <VratiNaDoradu id={clanak.id} /> : null}
            {radni === "odobren" && smePublish ? <Zakazi id={clanak.id} danas={danas} /> : null}
            {radni === "odobren" && smePublish ? <ObjaviOdmah id={clanak.id} verzija={last.broj} izmene={stanje.javno} /> : null}
            {radni === "zakazan" && smePublish ? <OtkaziTermin id={clanak.id} /> : null}
            {stanje.javno && smePublish ? <Povuci id={clanak.id} /> : null}
            {!strucna.potrebna && smeEdit && !stanje.javno ? <OznaciStrucnu id={clanak.id} /> : null}
          </div>
        </div>
      </section>

      <section className="portal-panel">
        <SectionHeader
          title="Pregled u izgledu sajta"
          description={`Poslednja sačuvana verzija (${last.broj}). Pregled vidi samo vlasnik; nije javan i ne indeksira se.${stanje.imaIzmene && javna ? ` Javno je trenutno verzija ${javna.broj}.` : ""}`}
        />
        <div className="portal-panel-body">
          <PregledOkvir src={pregledSrc} />
        </div>
      </section>

      <ClanakUrednik
        key={last.id}
        pocetno={{
          id: clanak.id,
          osnova: last.broj,
          slug: clanak.slug,
          tip: clanak.tip,
          kategorija: clanak.kategorija,
          naslov: last.naslov,
          metaNaslov: last.metaNaslov,
          opis: last.opis,
          telo: last.telo,
          izvori,
          interneNapomene: last.interneNapomene,
          nepotvrdjeno: last.nepotvrdjeno,
          slika,
        }}
        kategorije={SAVETI_KATEGORIJE as { slug: string; naziv: string }[]}
        tipovi={Object.entries(TIP_LABEL)}
        smeUredjivanje={smeEdit}
        javno={stanje.javno}
      />

      <section className="portal-panel">
        <SectionHeader title="Verzije" description="Svako čuvanje je nova verzija. Vraćanje ranije verzije pravi novu verziju sa njenim sadržajem, koja traži odobrenje." />
        <div className="portal-table-wrap">
          <table className="portal-table cl-table">
            <thead>
              <tr>
                <th>Verzija</th>
                <th>Sačuvano</th>
                <th>Poreklo</th>
                <th>Oznake</th>
                <th>
                  <span className="sr-only">Radnja</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...verzije].reverse().map((v) => (
                <tr key={v.id}>
                  <td data-label="Verzija">
                    {v.broj}
                    <small className="cl-sub">otisak {v.otisak.slice(0, 8)}</small>
                  </td>
                  <td data-label="Sačuvano">
                    {vremeSrbije(v.napravljeno)}
                    <small className="cl-sub">{v.napravio ? imena.get(v.napravio) ?? "—" : "Uvoz iz repozitorijuma"}</small>
                  </td>
                  <td data-label="Poreklo">{v.poreklo.startsWith("vracanje:") ? `vraćena verzija ${v.poreklo.slice(9)}` : v.poreklo === "panel" ? "panel" : "uvoz"}</td>
                  <td data-label="Oznake">
                    {v.id === stanje.javnaVerzijaId ? <Badge tone="success">javna</Badge> : null}{" "}
                    {v.id === odobrenaVerzijaId ? <Badge tone="info">odobrena</Badge> : null}
                  </td>
                  <td>{smeEdit && v.broj !== last.broj ? <VratiVerziju id={clanak.id} broj={v.broj} osnova={last.broj} /> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="portal-panel">
        <SectionHeader title="Istorija" description="Ko je i kada sačuvao, poslao na pregled, odobrio, zakazao, objavio ili povukao članak. Vreme je po vremenu Srbije." />
        <ol className="cl-history portal-panel-body">
          {dogadjaji.map((d) => {
            const det = (d.detalji ?? {}) as Record<string, unknown>;
            const verzija = verzije.find((v) => v.id === d.verzijaId);
            return (
              <li key={d.id}>
                <span className="cl-history-time">{vremeSrbije(d.vreme)}</span>
                <span>
                  <strong>{(RADNJA_LABEL as Record<string, string>)[d.radnja] ?? d.radnja}</strong>
                  {verzija ? ` · verzija ${verzija.broj}` : ""}
                  {typeof det.termin === "string" ? ` · termin ${vremeSrbije(det.termin)}` : ""}
                  {det.promenaSadrzaja === false ? " · samo interne napomene" : ""}
                  {typeof det.razlog === "string" ? ` · ${det.razlog}` : ""}
                  {typeof det.napomena === "string" && det.napomena ? ` · ${det.napomena}` : ""}
                  {typeof det.od === "string" ? ` · /vodici/${det.od} → /vodici/${String(det.na)}` : ""}
                  {typeof det.strucnjak === "string" ? ` · ${det.strucnjak} (${String(det.uloga)}), ${String(det.datum)}` : ""}
                  <small className="cl-sub">{d.korisnikIme ?? "—"}</small>
                </span>
              </li>
            );
          })}
        </ol>
        {objave.length ? (
          <div className="portal-panel-body">
            <h3 className="cl-h3">Objave</h3>
            <ul className="cl-history">
              {objave.map((o) => (
                <li key={o.id}>
                  <span className="cl-history-time">{vremeSrbije(o.termin ?? o.vreme)}</span>
                  <span>
                    <strong>{o.ishod === "objavljene_izmene" ? "Objavljene izmene" : "Objavljeno"}</strong> · {o.razlog}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}
