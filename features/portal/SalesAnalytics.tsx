import Link from "next/link";
import { UnavailableValue } from "@/components/portal/PhaseNotice";
import {
  averageInvoice,
  concentration,
  deltaPercent,
  UNKNOWN_NEGATIVE_LABEL,
} from "@/lib/sales/totals.mjs";
import type {
  SalesBreakdownRow,
  SalesLine,
  SalesSummary,
} from "@/lib/sales/queries";
import { percent } from "@/lib/ordering/panelFormat.mjs";

const MONEY = new Intl.NumberFormat("sr-Latn-RS", {
  maximumFractionDigits: 0,
});
const MONEY2 = new Intl.NumberFormat("sr-Latn-RS", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Zaokruženo na ceo dinar (tabele; valuta je u zaglavlju kolone). */
export function money(value: number | null) {
  return value === null ? "—" : MONEY.format(value);
}

/** Isto, uz oznaku valute — za pokazatelje i rečenice. */
export function moneyRsd(value: number | null) {
  return value === null ? "—" : `${MONEY.format(value)}\u00a0RSD`;
}

export type GroupView = "kupci" | "komercijalisti" | "artikli" | "grupe";

/** Najviše stavki u listi na ekranu; zbirovi se računaju nad svim stavkama. */
export const SALES_LINES_DISPLAY = 500;

const GROUP_LABELS: Record<GroupView, string> = {
  kupci: "Kupac",
  komercijalisti: "Komercijalista",
  artikli: "Artikal",
  grupe: "Grupa proizvoda",
};

/**
 * Pokazatelji perioda. Svi brojevi dolaze iz agregata nad CELIM filtriranim
 * skupom u bazi (`loadSalesSummary`), ne iz liste stavki prikazane na ekranu.
 */
export function SalesTotals({
  totals,
  previous,
  byCustomer,
}: {
  totals: SalesSummary;
  previous?: SalesSummary | null;
  /** Zbirovi po kupcu (ceo skup) — za koncentraciju top 10. */
  byCustomer: readonly SalesBreakdownRow[];
}) {
  const invoiceCount = totals.invoiceCount;
  const change = previous ? deltaPercent(totals.net, previous.net) : null;
  const udeo = concentration(byCustomer);

  const cards = [
    {
      label: "Bruto promet",
      value: moneyRsd(totals.gross),
      context: "zbir pozitivnih stavki",
      tone: "neutral",
    },
    {
      label: "Povrati robe",
      value: moneyRsd(totals.returnValue),
      context: `${MONEY2.format(totals.returnedQuantity)} jedinica vraćeno`,
      tone: "danger",
    },
    {
      label: "Korekcije",
      value: moneyRsd(totals.correctionValue),
      context: "storno, odobrenja, korekcije cene",
      tone: "warning",
    },
    {
      label: "Neto promet",
      value: moneyRsd(totals.net),
      context:
        change === null
          ? "nema uporednog perioda"
          : `${change > 0 ? "+" : ""}${percent(change)} u odnosu na prethodni period`,
      tone: "success",
    },
    {
      label: "Broj faktura",
      value: MONEY.format(invoiceCount),
      context: "dokumenata u periodu",
      tone: "neutral",
    },
    {
      label: "Prosečna faktura",
      value: moneyRsd(averageInvoice(totals.net, invoiceCount)),
      context: "neto po dokumentu",
      tone: "info",
    },
    {
      label: "Koncentracija top 10",
      value: udeo === null ? "—" : percent(udeo),
      context: "udeo najvećih kupaca",
      tone: "warning",
    },
  ];

  return (
    <>
      <div className="portal-metrics">
        {cards.map((card) => (
          <div key={card.label} className="portal-metric" data-tone={card.tone}>
            <span className="portal-metric-label">{card.label}</span>
            <strong className="portal-metric-value">{card.value}</strong>
            <small className="portal-metric-context">{card.context}</small>
          </div>
        ))}
        <div className="portal-metric" data-tone="warning">
          <span className="portal-metric-label">Naplata i dugovanja</span>
          <strong className="portal-metric-value">
            <UnavailableValue note="Fakture ne sadrže podatke o plaćanju." />
          </strong>
          <small className="portal-metric-context">
            Potreban je odvojen, proveren izvor uplata.
          </small>
        </div>
      </div>

      {totals.unknownNegativeCount > 0 ? (
        <p className="portal-permission-ok" role="status">
          {totals.unknownNegativeCount} negativnih stavki u iznosu{" "}
          {moneyRsd(totals.unknownNegativeValue)}: {UNKNOWN_NEGATIVE_LABEL}. Ulaze u
          neto promet, ali se ne pripisuju ni povratu ni korekciji.
        </p>
      ) : null}
    </>
  );
}

const BROJ = new Intl.NumberFormat("sr-Latn-RS");

export function SalesBreakdown({
  rows,
  totals,
  view,
  drillDownBase,
}: {
  /** Zbirovi po grupi nad celim skupom (`loadSalesBreakdown`). */
  rows: readonly SalesBreakdownRow[];
  totals: SalesSummary;
  view: GroupView;
  /** Osnova za drill-down; kada je zadata, red vodi na fakture. */
  drillDownBase?: string;
}) {
  const grouped = rows;

  return (
    <div className="portal-table-wrap">
      <table className="portal-table">
        <thead>
          <tr>
            <th scope="col">{GROUP_LABELS[view]}</th>
            <th scope="col">Bruto</th>
            <th scope="col">Povrati</th>
            <th scope="col">Korekcije</th>
            <th scope="col">Nerazvrstano</th>
            <th scope="col">Neto</th>
            <th scope="col">Faktura</th>
          </tr>
        </thead>
        <tbody>
          {grouped.map((row) => {
            const customerId =
              view === "kupci" && drillDownBase ? row.customerId : null;
            return (
              <tr key={row.key}>
                <th scope="row">
                  {customerId ? (
                    <Link href={`${drillDownBase}?kupac=${customerId}`}>
                      {row.label}
                    </Link>
                  ) : (
                    row.label
                  )}
                </th>
                <td className="portal-table-number">{money(row.gross)}</td>
                <td className="portal-table-number">{money(row.returnValue)}</td>
                <td className="portal-table-number">
                  {money(row.correctionValue)}
                </td>
                <td className="portal-table-number">
                  {row.unknownNegativeValue === 0
                    ? "—"
                    : money(row.unknownNegativeValue)}
                </td>
                <td className="portal-table-number">
                  <strong>{money(row.net)}</strong>
                </td>
                <td className="portal-table-number">{row.invoiceCount}</td>
              </tr>
            );
          })}
          {grouped.length === 0 ? (
            <tr>
              <td colSpan={7}>Nema podataka za izabrane filtere.</td>
            </tr>
          ) : (
            <tr>
              <th scope="row">UKUPNO</th>
              <td className="portal-table-number">{money(totals.gross)}</td>
              <td className="portal-table-number">{money(totals.returnValue)}</td>
              <td className="portal-table-number">
                {money(totals.correctionValue)}
              </td>
              <td className="portal-table-number">
                {money(totals.unknownNegativeValue)}
              </td>
              <td className="portal-table-number">
                <strong>{money(totals.net)}</strong>
              </td>
              <td className="portal-table-number">{totals.invoiceCount}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Poslednji nivo drill-down-a: pojedinačne stavke faktura. */
export function SalesLines({
  lines,
  totalLines,
}: {
  lines: SalesLine[];
  /** Broj stavki u celom filtriranom skupu (iz agregata). */
  totalLines: number;
}) {
  const PRIKAZ = SALES_LINES_DISPLAY;
  return (
    <>
      {totalLines > Math.min(lines.length, PRIKAZ) ? (
        <p className="portal-data-note">
          Lista prikazuje najnovijih {BROJ.format(Math.min(lines.length, PRIKAZ))}{" "}
          od {BROJ.format(totalLines)} stavki. Zbirovi iznad obuhvataju sve
          stavke; za ostale redove suzite filtere ili preuzmite izvoz.
        </p>
      ) : null}
      <div className="portal-table-wrap">
        <table className="portal-table">
          <thead>
            <tr>
              <th scope="col">Faktura</th>
              <th scope="col">Datum</th>
              <th scope="col">Vrsta</th>
              <th scope="col">Kupac</th>
              <th scope="col">Komercijalista</th>
              <th scope="col">Artikal</th>
              <th scope="col">Količina</th>
              <th scope="col">Iznos</th>
            </tr>
          </thead>
          <tbody>
            {lines.slice(0, PRIKAZ).map((line, index) => (
              <tr key={`${line.invoiceId}-${line.articleCode}-${index}`}>
                <th scope="row">
                  <Link href={`/portal/prodaja/faktura/${line.invoiceId}`}>
                    {line.invoiceNumber}
                  </Link>
                </th>
                <td className="portal-table-nowrap">{line.issuedOn}</td>
                <td>
                  {line.documentKind === "nepoznato" && line.lineAmount < 0 ? (
                    <span className="portal-unavailable">
                      {UNKNOWN_NEGATIVE_LABEL}
                    </span>
                  ) : (
                    (line.sourceDocumentType ?? line.documentKind)
                  )}
                </td>
                <td>{line.customerName}</td>
                <td>{line.salespersonName ?? "—"}</td>
                <td>
                  <strong>{line.articleCode}</strong>
                  <small>{line.articleName ?? ""}</small>
                </td>
                <td className="portal-table-number">
                  {MONEY2.format(line.quantity)}
                </td>
                <td className="portal-table-number">{money(line.lineAmount)}</td>
              </tr>
            ))}
            {lines.length === 0 ? (
              <tr>
                <td colSpan={8}>Nema stavki za izabrane filtere.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
