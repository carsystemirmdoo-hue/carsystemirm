import Link from "next/link";
import { ClickableRows } from "@/components/portal/ClickableRows";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { SortHeader } from "@/components/portal/SortHeader";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { sortRows } from "@/lib/ui/sortRows.mjs";
import {
  autoRefreshReceivables,
  debtsByCustomer,
  latestSnapshot,
  customersForLinking,
  receivablesSourceConfigured,
  sheetAssignmentSuggestions,
  unmatchedDebtLines,
  type CustomerDebt,
} from "@/lib/sales-tools/receivables-service";
import { DebtTools } from "./DebtTools";
import { SheetMatching } from "./SheetMatching";

export const metadata = { title: "Dugovanja" };

export const dynamic = "force-dynamic";

const whole = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 0 });
const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : "—");
const stamp = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}. u ${s.slice(11, 16)}`;

const KOLONE = {
  kupac: { value: (r: CustomerDebt) => r.customerName, first: "asc" },
  ukupno: { value: (r: CustomerDebt) => r.total, first: "desc" },
  dospelo: { value: (r: CustomerDebt) => r.overdueTotal, first: "desc" },
  fakture: { value: (r: CustomerDebt) => r.invoices, first: "desc" },
  kasni: { value: (r: CustomerDebt) => r.maxDaysOverdue, first: "desc" },
} as const;
type Kolona = keyof typeof KOLONE;

/**
 * Dugovanja (2026-11-10): otvorene i delimično plaćene fakture iz tabele kancelarije,
 * po kupcu. Komercijalista vidi samo svoje kupce; vlasnik i kancelarija sve, uz redove
 * koje nije bilo moguće povezati sa kupcem.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCapability("view:dugovanja", "/portal/dugovanja");
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const configured = receivablesSourceConfigured();
  const refreshProblem = await autoRefreshReceivables(user.id);
  const [snap, rows] = await Promise.all([latestSnapshot(), debtsByCustomer(user)]);
  const all = seesAllCustomers(user);
  const [unmatched, suggestions, linkable] = all && snap ? await Promise.all([unmatchedDebtLines(), sheetAssignmentSuggestions(), customersForLinking()]) : [[], [], []];
  const canUpload = can(user, "imports:write");

  const q = one("q").trim();
  const key: Kolona = one("red") in KOLONE ? (one("red") as Kolona) : "dospelo";
  const dir: "asc" | "desc" = one("smer") === "asc" || one("smer") === "desc" ? (one("smer") as "asc" | "desc") : KOLONE[key].first;
  const href = (k: Kolona) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    p.set("red", k);
    p.set("smer", k === key ? (dir === "asc" ? "desc" : "asc") : KOLONE[k].first);
    return `/portal/dugovanja?${p.toString()}`;
  };
  const head = (k: Kolona, text: string, right = false) => (
    <SortHeader label={text} active={k === key} dir={dir} href={href(k)} align={right ? "right" : "left"} className={right ? "pk-num" : undefined} />
  );
  const t = q.toLocaleLowerCase("sr-Latn");
  const shown = sortRows(t ? rows.filter((r) => r.customerName.toLocaleLowerCase("sr-Latn").includes(t)) : rows, KOLONE[key].value, dir);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const overdue = rows.reduce((s, r) => s + r.overdueTotal, 0);

  return (
    <>
      <PageHeader
        eyebrow={all ? "Finansije" : "Prodaja"}
        title="Dugovanja"
        description={
          all
            ? "Neplaćene i delimično plaćene fakture iz tabele kancelarije, po kupcu. Faktura koje nema u tabeli je plaćena."
            : "Neplaćene i delimično plaćene fakture Vaših kupaca. Kliknite na kupca da vidite fakture."
        }
        meta={snap ? <span>Stanje iz tabele: provereno {stamp(snap.checkedAt)}{snap.source === "upload" ? ` (otpremljen fajl ${snap.sourceRef})` : ""}</span> : undefined}
      />

      {refreshProblem ? <p className="dg-msg dg-msg--err" role="status">{refreshProblem}</p> : null}

      {!snap ? (
        <section className="portal-panel">
          <div className="portal-panel-body dg-setup">
            <h2>Tabela dugovanja još nije povezana</h2>
            {all ? (
              <>
                <p>Portal čita Google tabelu u kojoj kancelarija vodi neplaćene i delimično plaćene fakture. Ništa u tabeli ne menja.</p>
                <ol>
                  <li>U tabeli kliknite <b>Deli</b> i dodajte adresu servisnog naloga portala kao <b>Čitalac</b>.</li>
                  <li>Adresu tabele i ključ servisnog naloga upisuje vlasnik u podešavanja servera (Vercel).</li>
                  <li>Prvi red tabele treba da ima nazive kolona, npr. <i>Kupac, PIB, Broj fakture, Datum, Valuta, Iznos, Uplaćeno, Ostatak</i>.</li>
                </ol>
                {canUpload ? <p>Do tada tabelu možete otpremiti kao XLSX ili CSV (Google tabela: Datoteka → Preuzmi).</p> : null}
              </>
            ) : (
              <p>Kada kancelarija poveže svoju tabelu, ovde ćete videti dugovanja svojih kupaca.</p>
            )}
            <DebtTools canRefresh={configured} canUpload={canUpload} />
          </div>
        </section>
      ) : (
        <>
          <div className="dg-metrics">
            <div className="dg-metric"><span>Ukupno duguju</span><strong>{whole(total)} RSD</strong></div>
            <div className="dg-metric dg-metric--late"><span>Dospelo (prošla valuta)</span><strong>{whole(overdue)} RSD</strong></div>
            <div className="dg-metric"><span>Kupaca sa dugom</span><strong>{rows.length}</strong></div>
          </div>

          <section className="portal-panel">
            <div className="dg-bar">
              <form method="get" className="rr-filters" role="search" aria-label="Pretraga kupaca">
                <label>
                  <span>Kupac</span>
                  <input type="search" name="q" defaultValue={q} placeholder="Upišite ime kupca" autoComplete="off" />
                </label>
                <input type="hidden" name="red" value={key} />
                <input type="hidden" name="smer" value={dir} />
                <button type="submit">Traži</button>
              </form>
              <DebtTools canRefresh={configured} canUpload={canUpload} />
            </div>
            <ClickableRows className="portal-table-wrap">
              <table className="portal-table rr-table rr-table--rows pk-table dg-table">
                <thead>
                  <tr>
                    {head("kupac", "Kupac")}
                    {head("ukupno", "Duguje", true)}
                    {head("dospelo", "Dospelo", true)}
                    {head("fakture", "Fakture", true)}
                    {head("kasni", "Najduže kasni", true)}
                    <th scope="col" aria-label="Otvori" />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.customerId}>
                      <th scope="row">
                        <Link className="rr-row-link" href={`/portal/dugovanja/${r.customerId}`}>{r.customerName}</Link>
                      </th>
                      <td className="pk-num" data-label="Duguje"><b>{whole(r.total)}</b></td>
                      <td className="pk-num" data-label="Dospelo">{r.overdueTotal > 0 ? <span className="pk-late">{whole(r.overdueTotal)}</span> : "—"}</td>
                      <td className="pk-num" data-label="Fakture">{r.invoices}</td>
                      <td className="pk-num" data-label="Najduže kasni">{r.maxDaysOverdue ? `${r.maxDaysOverdue} d` : "—"}</td>
                      <td className="pk-open">Otvori →</td>
                    </tr>
                  ))}
                  {shown.length === 0 ? (
                    <tr><td colSpan={6}>{t ? "Nema kupca sa tim imenom." : all ? "Nijedan kupac nema otvorenu fakturu." : "Vaši kupci nemaju otvorenih faktura."}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </ClickableRows>
          </section>

          {all ? <SheetMatching unmatched={unmatched} customers={linkable} suggestions={suggestions} canAssign={can(user, "assignments:manage")} /> : null}
          {all && snap.warnings.length ? (
            <section className="portal-panel">
              <div className="portal-panel-body">
                <h2 className="dg-h">Redovi za proveru u tabelama</h2>
                <ul className="dg-warn">
                  {snap.warnings.slice(0, 30).map((w, i) => <li key={i}>Red {w.row}: {w.text}</li>)}
                </ul>
              </div>
            </section>
          ) : null}
          <p className="portal-footnote">Snimak od {dmy(snap.createdAt.slice(0, 10))} ({snap.sourceRef}): {snap.rowCount} otvorenih faktura.</p>
        </>
      )}
    </>
  );
}
