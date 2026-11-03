import Link from "next/link";
import { Badge, PageHeader, PortalLinkButton, SectionHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { SAVETI_KATEGORIJE } from "@/lib/saveti/kategorije.mjs";
import { spisakClanaka, TIP_LABEL } from "@/lib/saveti/urednik/servis";
import { STATUS_LABEL, STATUS_TONE, STATUSI, vremeSrbije } from "@/lib/saveti/urednik/stanje.mjs";

type Tone = "info" | "success" | "neutral" | "warning" | "danger";

export const metadata = { title: "Članci" };
export const dynamic = "force-dynamic";


type Props = { searchParams: Promise<{ q?: string; status?: string; tema?: string }> };

/** „Saveti i vodiči“ — spisak članaka (samo vlasnik; provera na serveru). */
export default async function ClanciPage({ searchParams }: Props) {
  const actor = await requireCapability("view:clanci", "/portal/clanci");
  const sp = await searchParams;
  const status = STATUSI.some((s) => s.key === sp.status) ? sp.status : "";
  const tema = SAVETI_KATEGORIJE.some((k: { slug: string }) => k.slug === sp.tema) ? sp.tema : "";
  const q = (sp.q ?? "").slice(0, 120);
  const { rows, brojac, ukupno } = await spisakClanaka(actor, { pretraga: q, status, kategorija: tema });
  const href = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q ? { q } : {}), ...(status ? { status } : {}), ...(tema ? { tema } : {}), ...patch });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    const s = p.toString();
    return `/portal/clanci${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Sadržaj"
        title="Članci"
        description="Saveti i vodiči: nacrti, pregled, odobrenje i objava. Javno izlaze samo verzije koje odobri vlasnik, u vreme koje sam zakaže."
        actions={can(actor, "articles:edit") ? <PortalLinkButton href="/portal/clanci/novi" variant="primary" icon="plus">Novi članak</PortalLinkButton> : undefined}
        meta={<span>Nema automatskog rasporeda: svaki članak se objavljuje pojedinačno, posle odobrenja.</span>}
      />

      <section className="portal-panel">
        <form className="cl-filters" action="/portal/clanci" role="search">
          <label className="portal-field cl-grow">
            <span>Pretraga</span>
            <input type="search" name="q" defaultValue={q} placeholder="Naslov, adresa ili oznaka (SV-…)" />
          </label>
          <label className="portal-field">
            <span>Tema</span>
            <select name="tema" defaultValue={tema}>
              <option value="">Sve teme</option>
              {SAVETI_KATEGORIJE.map((k: { slug: string; naziv: string }) => (
                <option key={k.slug} value={k.slug}>
                  {k.naziv}
                </option>
              ))}
            </select>
          </label>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button type="submit" className="portal-button" data-variant="secondary">
            Primenite
          </button>
        </form>
        <nav className="cl-status-tabs" aria-label="Filter po statusu">
          <Link href={href({ status: "" })} aria-current={!status ? "page" : undefined}>
            Svi <span>{ukupno}</span>
          </Link>
          {STATUSI.map((s) => (
            <Link key={s.key} href={href({ status: s.key })} aria-current={status === s.key ? "page" : undefined}>
              {s.label} <span>{brojac[s.key] ?? 0}</span>
            </Link>
          ))}
        </nav>
      </section>

      <section className="portal-panel">
        <SectionHeader title={`${rows.length} ${rows.length === 1 ? "članak" : "članaka"}`} description="Objavljen članak sa izmenama u radu pojavljuje se i pod statusom izmena (npr. „Za pregled“)." />
        {rows.length === 0 ? (
          <p className="portal-panel-body cl-empty">Nema članaka za izabrani filter.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table cl-table">
              <thead>
                <tr>
                  <th>Članak</th>
                  <th>Tema</th>
                  <th>Status</th>
                  <th>Objava</th>
                  <th>Poslednja izmena</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Članak">
                      <Link href={`/portal/clanci/${r.id}`} className="cl-title-link">
                        {r.naslov}
                      </Link>
                      <small className="cl-sub">
                        {r.id} · {TIP_LABEL[r.tip] ?? r.tip} · verzija {r.verzija}
                        {r.imaSliku ? " · sa slikom" : ""}
                      </small>
                      {r.strucnaPotvrda ? (
                        <small className="cl-sub">
                          <Badge tone="warning">čeka stručnu potvrdu</Badge>
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Tema">{r.kategorijaNaziv}</td>
                    <td data-label="Status">
                      <Badge tone={(STATUS_TONE[r.status] ?? "neutral") as Tone}>{STATUS_LABEL[r.status]}</Badge>
                      {r.imaIzmene ? (
                        <small className="cl-sub">
                          izmene: <Badge tone={(STATUS_TONE[r.radniStatus] ?? "neutral") as Tone}>{STATUS_LABEL[r.radniStatus]}</Badge>
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Objava">{r.termin ? `zakazano ${vremeSrbije(r.termin)}` : r.javnoOd ? vremeSrbije(r.javnoOd) : "—"}</td>
                    <td data-label="Poslednja izmena">{r.izmenjeno ? vremeSrbije(r.izmenjeno) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
