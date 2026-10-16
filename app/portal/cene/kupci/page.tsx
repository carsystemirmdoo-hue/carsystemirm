import Link from "next/link";
import { requireCapability } from "@/lib/authz/session";
import { listRebateCustomers } from "@/lib/pricing/customer-rebate-service";
import { RecentCustomers } from "./RecentCustomers";
import { optKey, pct } from "./format";
import "./cene-kupca.css";

export const metadata = { title: "Cene po kupcu" };
export const dynamic = "force-dynamic";

/** Izbor kupca: komercijalista vidi samo svoje kupce, ostali sve (samo pregled ili izmena po ulozi). */
export default async function RebateCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireCapability("view:cene_kupca", "/portal/cene/kupci");
  const { q = "" } = await searchParams;
  const query = q.trim().slice(0, 80);
  const { rows, total, seesAll } = await listRebateCustomers(user, query);
  const lead =
    user.role === "komercijalista"
      ? "Vaši kupci: menjate i čuvate rabate za avans i odloženo. Vlasnik dobija obaveštenje."
      : user.role === "gazda"
        ? "Svi kupci. Menjate i čuvate rabate; dodeljeni komercijalista dobija obaveštenje."
        : "Dogovoreni rabati i cene kupaca — samo pregled.";

  return (
    <div className="pn">
      <div className="pn-head">
        <div>
          <h1 className="pn-title">Cene po kupcu</h1>
          <p className="pn-lead">{lead}</p>
        </div>
      </div>
      <section className="pn-card" style={{ gap: 16 }}>
        <form method="get" action="/portal/cene/kupci" className="pn-field" style={{ maxWidth: 620 }} role="search">
          <label htmlFor="kupac-q" style={{ fontSize: 16 }}>Izaberite kupca</label>
          <div className="pn-inline">
            <input id="kupac-q" name="q" type="search" defaultValue={query} placeholder="Naziv, PIB ili mesto" autoComplete="off" style={{ flex: 1, minWidth: 0, minHeight: 48, fontSize: 17 }} />
            <button type="submit" className="pn-btn">Pronađite</button>
          </div>
          <span className="pn-help">{seesAll ? `Prikazani su svi kupci${total > rows.length ? ` — prvih ${rows.length} od ${total}, suzite pretragu` : ""}.` : "Prikazani su samo kupci dodeljeni Vama."}</span>
        </form>
        <RecentCustomers known={rows.map((r) => ({ id: r.id, name: r.name }))} />
        <div className="ck-wrap">
          <table className="pn-table pn-table-cards">
            <thead>
              <tr>
                <th>Kupac</th>
                <th>Mesto</th>
                <th>Komercijalista</th>
                <th className="pn-r">Osnovni rabat</th>
                <th><span className="pn-sr">Radnja</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td data-label="Kupac">
                    <Link href={`/portal/cene/kupci/${c.id}`} className="pn-row-link">{c.name}</Link>
                    <span className="pn-sub pn-num">PIB {c.pib}</span>
                  </td>
                  <td data-label="Mesto">{c.city ?? "—"}</td>
                  <td data-label="Komercijalista">{c.reps.length ? c.reps.join(", ") : <span className="pn-muted">nije dodeljen</span>}</td>
                  <td data-label="Osnovni rabat" className="pn-r">
                    {c.options.map((o) => (
                      <span key={o.code ?? "osnovno"} className="pn-sub pn-num" data-opt={optKey(o.code)} style={{ color: "var(--p-ink)" }}>
                        {o.label}: <b>{pct(o.rabat)}</b>
                      </span>
                    ))}
                  </td>
                  <td className="pn-r">
                    <Link href={`/portal/cene/kupci/${c.id}`} className="pn-btn" data-size="sm">
                      {c.canEdit ? "Otvorite cene" : "Pregled cena"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? <p className="pn-empty" style={{ padding: 16 }}>{query ? `Nijedan kupac ne odgovara pretrazi „${query}“.` : "Nema kupaca u Vašem opsegu."}</p> : null}
        </div>
      </section>
    </div>
  );
}
