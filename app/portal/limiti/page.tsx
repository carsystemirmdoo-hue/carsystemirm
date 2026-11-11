import Link from "next/link";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { evaluateCreditWarnings, loadCreditOverview, type CreditRow } from "@/lib/credit/credit-service";
import { LATE_DAYS, NEAR_SHARE } from "@/lib/credit/creditLimit.mjs";
import { autoRefreshReceivables } from "@/lib/sales-tools/receivables-service";
import { DefaultPercentForm, LimitEditor } from "./LimitEditor";

export const metadata = { title: "Kreditni limiti" };

export const dynamic = "force-dynamic";

const whole = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 0 });
const stamp = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}. u ${s.slice(11, 16)}`;
const ORDER: Record<CreditRow["status"], number> = { over: 0, near: 1, ok: 2, no_limit: 3 };
const LABEL: Record<CreditRow["status"], string> = { over: "preko limita", near: "blizu limita", ok: "u redu", no_limit: "bez limita" };

function basisText(r: CreditRow) {
  if (r.basis === "amount") return "tačan iznos";
  if (r.basis === "percent") return `${r.percent} % — za kupca`;
  if (r.basis === "default") return `${r.percent} % — podrazumevano`;
  return r.override?.percent !== null && r.override?.percent !== undefined ? `${r.override.percent} %, a nema kupovine` : "nema kupovine u 12 meseci";
}

/**
 * Kreditni limiti (0063; 2026-11-11). Limit = procenat prosečne mesečne kupovine sa PDV-om
 * (12 meseci); dug je današnje stanje iz tabele kancelarije. Upozorenje ide u zvonce vlasniku
 * i komercijalisti kupca; blokada porudžbina je opcija po kupcu.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCapability("view:limiti", "/portal/limiti");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  await autoRefreshReceivables(user.id);
  // Prvo otvaranje posle objave (i posle svake promene limita) — upozorenja odgovaraju ekranu.
  if (can(user, "limits:approve")) await evaluateCreditWarnings(user.id);
  const { rows, defaultPercent, debtCheckedAt } = await loadCreditOverview(user);
  const owner = can(user, "limits:approve");
  const focus = one("kupac");
  const filter = one("prikaz");
  const q = one("q").trim().toLocaleLowerCase("sr-Latn");

  const shown = rows
    .filter((r) => (filter === "problem" ? r.status === "over" || r.late : filter === "svi" ? true : r.debt > 0 || r.override !== null || r.customerId === focus))
    .filter((r) => !q || r.customerName.toLocaleLowerCase("sr-Latn").includes(q))
    .sort((a, b) => ORDER[a.status] - ORDER[b.status] || (b.usage ?? 0) - (a.usage ?? 0) || b.debt - a.debt);
  const over = rows.filter((r) => r.status === "over").length;
  const near = rows.filter((r) => r.status === "near").length;
  const late = rows.filter((r) => r.late).length;
  const href = (p: string) => `/portal/limiti?prikaz=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        eyebrow={owner ? "Finansije" : "Prodaja"}
        title="Kreditni limiti"
        description={`Limit = ${defaultPercent} % prosečne mesečne kupovine sa PDV-om u poslednjih 12 meseci, osim kada je kupcu upisan sopstveni. Dug je današnje stanje iz tabele kancelarije. Upozorenje stiže u obaveštenja kada dug pređe limit ili faktura kasni više od ${LATE_DAYS} dana.`}
        meta={debtCheckedAt ? <span>Dugovanja provereno {stamp(debtCheckedAt)}</span> : <span>Tabela dugovanja još nije učitana — limiti se računaju, dug je 0.</span>}
      />

      <div className="dg-metrics">
        <Link href={href("problem")} className="dg-metric dg-metric--late"><span>Preko limita</span><strong>{over}</strong></Link>
        <div className="dg-metric"><span>Blizu limita (≥ {Math.round(NEAR_SHARE * 100)} %)</span><strong>{near}</strong></div>
        <Link href={href("problem")} className="dg-metric dg-metric--late"><span>Kasni &gt; {LATE_DAYS} dana</span><strong>{late}</strong></Link>
      </div>

      {owner ? (
        <section className="portal-panel">
          <div className="portal-panel-body">
            <DefaultPercentForm value={defaultPercent} />
            <p className="lm-hint">Važi za sve kupce kojima nije upisan sopstveni procenat ili iznos. Primer: kupac kupuje 100.000 RSD mesečno → limit {whole(1000 * defaultPercent)} RSD.</p>
          </div>
        </section>
      ) : null}

      <section className="portal-panel">
        <div className="dg-bar">
          <form method="get" className="rr-filters" role="search" aria-label="Pretraga kupaca">
            <label>
              <span>Kupac</span>
              <input type="search" name="q" defaultValue={one("q")} placeholder="Upišite ime kupca" autoComplete="off" />
            </label>
            <label>
              <span>Prikaz</span>
              <select name="prikaz" defaultValue={filter || "dug"}>
                <option value="dug">Kupci sa dugom ili upisanim limitom</option>
                <option value="problem">Samo preko limita ili kasne</option>
                <option value="svi">Svi kupci sa kupovinom</option>
              </select>
            </label>
            <button type="submit">Prikaži</button>
          </form>
        </div>
        <div className="portal-table-wrap">
          <table className="portal-table lm-table">
            <thead>
              <tr>
                <th scope="col">Kupac</th>
                <th scope="col">Stanje</th>
                <th scope="col">Duguje</th>
                <th scope="col">Limit</th>
                <th scope="col">Iskorišćeno</th>
                <th scope="col">Mesečna kupovina</th>
                <th scope="col">Najduže kasni</th>
                <th scope="col" aria-label="Podesi" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.customerId} data-focus={r.customerId === focus ? "true" : undefined}>
                  <th scope="row">
                    <Link href={`/portal/dugovanja/${r.customerId}`}>{r.customerName}</Link>
                    {r.reps.length ? <small>{r.reps.join(", ")}</small> : null}
                    {r.override?.blockOrders ? <small className="lm-block">blokada porudžbina uključena</small> : null}
                  </th>
                  <td data-sort-value={String(ORDER[r.status])}>
                    <span className="lm-status" data-s={r.status}>{LABEL[r.status]}</span>
                    {r.late ? <small className="lm-late">kasni</small> : null}
                  </td>
                  <td className="portal-table-number">{r.debt ? whole(r.debt) : "—"}</td>
                  <td className="portal-table-number">
                    {r.limit === null ? "—" : whole(r.limit)}
                    <small>{basisText(r)}</small>
                    {r.override ? <small title={`${r.override.setBy}, ${r.override.setAt.slice(0, 10)}`}>„{r.override.note}“</small> : null}
                  </td>
                  <td className="portal-table-number" data-sort-value={r.usage === null ? "" : String(Math.round(r.usage * 1000) / 10)}>
                    {r.usage === null ? "—" : (
                      <span className="lm-usage" data-s={r.status}>
                        <span className="lm-bar"><span style={{ width: `${Math.min(100, Math.round(r.usage * 100))}%` }} /></span>
                        {Number.isFinite(r.usage) ? `${Math.round(r.usage * 100)} %` : "∞"}
                      </span>
                    )}
                  </td>
                  <td className="portal-table-number">{r.avgMonthly ? whole(r.avgMonthly) : "—"}</td>
                  <td className="portal-table-number">{r.maxDaysOverdue ? `${r.maxDaysOverdue} d` : "—"}</td>
                  <td>
                    <LimitEditor
                      customerId={r.customerId}
                      customerName={r.customerName}
                      current={r.override}
                      defaultPercent={defaultPercent}
                      open={r.customerId === focus && one("podesi") === "1"}
                    />
                  </td>
                </tr>
              ))}
              {shown.length === 0 ? (
                <tr><td colSpan={8}>{filter === "problem" ? "Nijedan kupac nije preko limita niti kasni." : "Nema kupaca za ovaj izbor."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <p className="portal-footnote">
        Mesečna kupovina = zbir faktura sa PDV-om u poslednjih 365 dana / 12 (bez storniranih). Iznos limita koji je upisan ručno ne zavisi od kupovine.
        Komercijalista menja limite svojih kupaca; svaka izmena se beleži u Aktivnostima.
      </p>
    </>
  );
}
