import Link from "next/link";
import { DateRangeField } from "@/components/portal/DateRangeField";
import { money } from "@/features/portal/SalesAnalytics";
import { dmy } from "@/lib/ordering/panelFormat.mjs";
import { periodLabel } from "@/lib/portal/periodMemory.mjs";
import type { PeriodArticle } from "@/lib/sales/customer-period-service";
import { STOPPED_RULES } from "@/lib/sales/stoppedBuying.mjs";

const qty = new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 3 });
const PRIKAZ = 30;

type Stopped = {
  code: string;
  name: string | null;
  purchases: number;
  lastOn: string;
  daysSince: number;
  usualIntervalDays: number | null;
  thresholdDays: number;
  dismissed: boolean;
};

/**
 * Period na kartici kupca: „Najviše kupovano“ i „Prestao da uzima“ (zahtev vlasnika 2026-11-12/13).
 * Period se bira ovde ili na drugom ekranu portala i pamti se (vidi `periodMemory.mjs`).
 */
export function CustomerPeriod({
  customerId,
  period,
  articles,
  stopped,
  showAmounts,
  showAll,
}: {
  customerId: string;
  period: { from: string | null; to: string | null };
  articles: PeriodArticle[];
  stopped: Stopped[];
  showAmounts: boolean;
  showAll: boolean;
}) {
  const label = periodLabel(period);
  const shown = showAll ? articles : articles.slice(0, PRIKAZ);
  const total = articles.reduce((a, r) => a + r.net, 0);
  const allHref = `/portal/kupci/${customerId}?${new URLSearchParams({ from: period.from ?? "", to: period.to ?? "", sve: "1" })}#najvise-kupovano`;
  return (
    <>
      <section className="portal-panel" id="period">
        <form method="get" className="portal-inline-form">
          <DateRangeField nameOd="from" nameDo="to" defaultOd={period.from} defaultDo={period.to} zapamti />
          <button type="submit" className="portal-button" data-variant="primary">
            Prikažite
          </button>
        </form>
      </section>

      <section className="portal-panel" id="najvise-kupovano">
        <div className="portal-section-header">
          <div>
            <h2>
              Najviše kupovano · {label} ({articles.length})
            </h2>
            <p>
              Neto količina i {showAmounts ? "neto iznos" : "broj faktura"} po artiklu iz faktura u periodu; povrati se
              oduzimaju.{showAmounts && articles.length > 0 ? ` Ukupno neto: ${money(total)}.` : ""}
            </p>
          </div>
        </div>
        {articles.length === 0 ? (
          <p className="portal-panel-body">Kupac u ovom periodu nema faktura.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Šifra</th>
                  <th scope="col">Artikal</th>
                  <th scope="col">Količina</th>
                  {showAmounts ? <th scope="col">Neto</th> : null}
                  <th scope="col">Faktura</th>
                  <th scope="col">Poslednja u periodu</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => (
                  <tr key={a.code}>
                    <td>{a.code}</td>
                    <th scope="row">{a.name ?? "—"}</th>
                    <td className="portal-table-number">
                      {qty.format(a.quantity)} {a.unit ?? ""}
                    </td>
                    {showAmounts ? <td className="portal-table-number">{money(a.net)}</td> : null}
                    <td className="portal-table-number">{a.invoiceCount}</td>
                    <td>{dmy(a.lastOn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!showAll && articles.length > PRIKAZ ? (
          <p className="portal-footnote">
            Prikazano prvih {PRIKAZ}. <Link href={allHref}>Prikažite svih {articles.length} →</Link>
          </p>
        ) : null}
      </section>

      <section className="portal-panel" id="prestao-da-uzima">
        <div className="portal-section-header">
          <div>
            <h2>
              Prestao da uzima ({stopped.length})
            </h2>
            <p>
              Artikli koje je kupac kupio u periodu ({label}), a od poslednje kupovine je prošlo više od{" "}
              {STOPPED_RULES.multipleOfUsual}× uobičajenog razmaka (sa bar {STOPPED_RULES.minPurchasesForUsual} kupovine) ili
              više od {STOPPED_RULES.fallbackDays} dana (sa jednom ili dve kupovine); nikad manje od {STOPPED_RULES.minDays} dana.
            </p>
          </div>
        </div>
        {stopped.length === 0 ? (
          <p className="portal-panel-body">Nema artikala koje je kupac prestao da uzima.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Šifra</th>
                  <th scope="col">Artikal</th>
                  <th scope="col">Kupovina</th>
                  <th scope="col">Uobičajen razmak</th>
                  <th scope="col">Poslednja kupovina</th>
                  <th scope="col">Nije uzeo</th>
                </tr>
              </thead>
              <tbody>
                {stopped.map((a) => (
                  <tr key={a.code}>
                    <td>{a.code}</td>
                    <th scope="row">
                      {a.name ?? "—"}
                      {a.dismissed ? <small> · označeno „Ne uzima više“</small> : null}
                    </th>
                    <td className="portal-table-number">{a.purchases}</td>
                    <td className="portal-table-number">{a.usualIntervalDays === null ? "—" : `${a.usualIntervalDays} dana`}</td>
                    <td>{dmy(a.lastOn)}</td>
                    <td className="portal-table-number">
                      <strong>{a.daysSince} dana</strong>
                    </td>
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
