import Link from "next/link";
import { srDate } from "@/components/customer/account-format";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { requireCapability } from "@/lib/authz/session";
import { loadUnassignedCustomers } from "@/lib/partners/unassigned-service";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";

export const dynamic = "force-dynamic";

const MONEY = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 0 });
const SORTS = {
  promet12: { label: "Promet 12 meseci", by: (a: Row, b: Row) => b.net12m - a.net12m },
  poslednja: { label: "Poslednja kupovina", by: (a: Row, b: Row) => b.lastOn.localeCompare(a.lastOn) },
  ukupno: { label: "Promet ukupno", by: (a: Row, b: Row) => b.netTotal - a.netTotal },
  naziv: { label: "Naziv", by: (a: Row, b: Row) => a.name.localeCompare(b.name, "sr-Latn") },
} as const;
type Row = Awaited<ReturnType<typeof loadUnassignedCustomers>>[number];

const fold = (s: string) => s.toLocaleLowerCase("sr-Latn").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/đ/g, "dj");

/** Kupci bez dodeljenog komercijaliste — samo pregled; dodela se ovde ne menja. */
export default async function UnassignedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string }>;
}) {
  await requireCapability("view:bez_dodele", "/portal/kupci/bez-dodele");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const sort = sp.sort && sp.sort in SORTS ? (sp.sort as keyof typeof SORTS) : "promet12";
  const asOf = belgradeDate(new Date());
  const all = await loadUnassignedCustomers(asOf);
  const rows = all.filter((r) => !q || fold(r.name).includes(fold(q))).sort(SORTS[sort].by);
  const year = asOf.slice(0, 4);
  const active12 = all.filter((r) => r.net12m > 0).length;
  // Kolona samo kada izvor uopšte nosi komercijalistu na fakturi.
  const showRep = all.some((r) => r.historicalRep);

  return (
    <>
      <PageHeader
        eyebrow="Prodaja · Kupci"
        title="Bez dodeljenog komercijaliste"
        description="Kupci sa fakturama kojima trenutno nije dodeljen komercijalista. Pregled za odluku o zaduženju; dodela se ovde ne menja, a istorijske fakture ostaju kakve jesu."
        meta={
          <span>
            {all.length} kupaca · {active12} sa kupovinom u poslednjih 12 meseci · ukupno 12 meseci{" "}
            {MONEY.format(all.reduce((s, r) => s + r.net12m, 0))} RSD neto
          </span>
        }
      />
      <section className="portal-panel">
        <form method="get" className="rr-filters" role="search" aria-label="Pretraga">
          <label>
            <span>Kupac</span>
            <input type="search" name="q" defaultValue={q} placeholder="Naziv kupca" autoComplete="off" />
          </label>
          <label>
            <span>Redosled</span>
            <select name="sort" defaultValue={sort}>
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="portal-button" data-variant="primary">Prikažite</button>
        </form>
        <div className="portal-table-wrap">
          <table className="portal-table rr-table">
            <thead>
              <tr>
                <th scope="col">Kupac</th>
                <th scope="col">Poslednja kupovina</th>
                <th scope="col">Promet 12 m.</th>
                <th scope="col">Promet {year}.</th>
                <th scope="col">Promet ukupno</th>
                <th scope="col">Faktura</th>
                {showRep ? <th scope="col">Komercijalista na poslednjoj fakturi</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <th scope="row">
                    <Link href={`/portal/kupci/${r.id}`}>{r.name}</Link>
                  </th>
                  <td className="portal-table-nowrap">
                    {srDate(r.lastOn)}
                    <small>
                      <Link href={`/portal/prodaja/faktura/${r.lastInvoiceId}`}>{r.lastLabel}</Link>
                    </small>
                  </td>
                  <td className="portal-table-number">
                    <strong>{MONEY.format(r.net12m)}</strong>
                  </td>
                  <td className="portal-table-number">{MONEY.format(r.netYear)}</td>
                  <td className="portal-table-number">{MONEY.format(r.netTotal)}</td>
                  <td className="portal-table-number">{r.invoices}</td>
                  {showRep ? (
                    <td>
                      {r.historicalRep ?? "—"}
                      <small>istorijski podatak, ne zaduženje</small>
                    </td>
                  ) : null}
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={showRep ? 7 : 6}>Nema kupaca za pretragu.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
