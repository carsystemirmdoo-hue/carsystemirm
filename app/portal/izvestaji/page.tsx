import Link from "next/link";
import { DateRangeField } from "@/components/portal/DateRangeField";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { readPortalPeriod } from "@/lib/portal/period";
import { periodLabel } from "@/lib/portal/periodMemory.mjs";

export const metadata = { title: "Izveštaji" };

export const dynamic = "force-dynamic";

const REPORTS = [
  { view: "kupci", title: "Promet po kupcu", text: "Bruto, povrati, korekcije, neto i broj faktura po kupcu." },
  { view: "artikli", title: "Promet po artiklu", text: "Količina i iznos po artiklu, za ceo promet ili izabran period." },
  { view: "komercijalisti", title: "Promet po komercijalisti", text: "Zbir po komercijalisti sa fakture." },
  { view: "grupe", title: "Promet po grupi proizvoda", text: "Zbir po grupi iz šifarnika." },
  { view: "stavke", title: "Stavke faktura", text: "Svaka stavka svake fakture u periodu (najnovije prve)." },
] as const;

/**
 * Izveštaji (2026-11-13): jedno mesto za izvoze koji već postoje. Ranije je ekran čekao „izvor
 * podataka“, a fakture se uvoze od oktobra — izvoz koristi isti filter i opseg kao Prodaja.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const user = await requireCapability("view:izvestaji", "/portal/izvestaji");
  const period = await readPortalPeriod(await searchParams);
  const canExport = can(user, "export:data");
  const qs = new URLSearchParams();
  if (period.from) qs.set("from", period.from);
  if (period.to) qs.set("to", period.to);

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Izveštaji"
        description="Izvoz u XLSX, CSV i PDF za izabrani period. Izvoz sadrži samo kupce koje smete da vidite; vreme nastanka je u zaglavlju."
      />
      <section className="portal-panel">
        <form method="get" className="portal-inline-form" style={{ padding: 16 }}>
          <DateRangeField nameOd="from" nameDo="to" defaultOd={period.from} defaultDo={period.to} zapamti />
          <button type="submit" className="portal-button" data-variant="primary">
            Primenite
          </button>
        </form>
      </section>
      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Prodaja · {periodLabel(period)}</h2>
            <p>
              Isti podaci kao na ekranu <Link href="/portal/prodaja">Prodaja</Link>; tamo možete suziti i na jednog kupca,
              komercijalistu ili grupu pre izvoza.
            </p>
          </div>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table" data-sort="off">
            <tbody>
              {REPORTS.map((r) => (
                <tr key={r.view}>
                  <th scope="row">
                    {r.title}
                    <small style={{ display: "block", fontWeight: 400 }}>{r.text}</small>
                  </th>
                  <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                    {canExport ? (
                      (["xlsx", "csv", "pdf"] as const).map((format) => (
                        <a key={format} className="portal-button" style={{ marginLeft: 6 }} href={`/api/portal/izvoz?format=${format}&view=${r.view}&${qs.toString()}`}>
                          {format.toUpperCase()}
                        </a>
                      ))
                    ) : (
                      <span>Izvoz nije dozvoljen Vašoj ulozi.</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Ostali izvozi</h2>
            <p>Izvozi koji se prave na svom ekranu, iz onoga što ste tamo izabrali.</p>
          </div>
        </div>
        <ul className="portal-panel-body" style={{ margin: 0, paddingLeft: 32 }}>
          {can(user, "view:nabavka") ? (
            <li>
              <Link href="/portal/nabavka">Nabavka</Link> — fajl porudžbine dobavljaču (šifra, naziv, količina, JM).
            </li>
          ) : null}
          {can(user, "view:preporuke") ? (
            <li>
              <Link href="/portal/preporuke">Preporuke</Link> — Excel ponuda za kupca (sa kartice preporuka kupca).
            </li>
          ) : null}
          {can(user, "view:prodaja") ? (
            <li>
              <Link href="/portal/prodaja">Prodaja</Link> i <Link href="/portal/analitika">Analitika</Link> — izvoz trenutnog prikaza
              sa svim filterima.
            </li>
          ) : null}
        </ul>
      </section>
    </>
  );
}
