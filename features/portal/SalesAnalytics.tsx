import Link from "next/link";
import { UnavailableValue } from "@/components/portal/PhaseNotice";
import { SALES_LINES_LIMIT } from "@/lib/sales/limits";
import {
  averageInvoice,
  concentration,
  deltaPercent,
  summarize,
  summarizeBy,
  UNKNOWN_NEGATIVE_LABEL,
} from "@/lib/sales/totals.mjs";
import type { SalesLine } from "@/lib/sales/queries";

const MONEY = new Intl.NumberFormat("sr-Latn-RS", {
  maximumFractionDigits: 0,
});
const MONEY2 = new Intl.NumberFormat("sr-Latn-RS", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(value: number | null) {
  return value === null ? "—" : MONEY.format(value);
}

export type GroupView = "kupci" | "komercijalisti" | "artikli" | "grupe";

const GROUP_LABELS: Record<GroupView, string> = {
  kupci: "Kupac",
  komercijalisti: "Komercijalista",
  artikli: "Artikal",
  grupe: "Grupa proizvoda",
};

function keyFor(view: GroupView) {
  return (line: SalesLine) => {
    if (view === "kupci") return line.customerName;
    if (view === "komercijalisti") return line.salespersonName ?? "Bez komercijaliste";
    if (view === "grupe") return line.productGroup ?? "Bez grupe";
    return `${line.articleCode} · ${line.articleName ?? ""}`.trim();
  };
}

/** Ključ kupca za drill-down; grupisanje po imenu, veza po ID-u. */
function customerIdFor(lines: SalesLine[], label: string) {
  return lines.find((line) => line.customerName === label)?.customerId ?? null;
}

export function SalesTotals({
  lines,
  previous,
}: {
  lines: SalesLine[];
  previous?: SalesLine[];
}) {
  const totals = summarize(lines);
  const invoiceCount = new Set(lines.map((line) => line.invoiceId)).size;
  const previousTotals = previous ? summarize(previous) : null;
  const change = previousTotals
    ? deltaPercent(totals.net, previousTotals.net)
    : null;
  const byCustomer = summarizeBy(lines, (line) => line.customerName);

  const cards = [
    {
      label: "Bruto promet",
      value: money(totals.gross),
      context: "zbir pozitivnih stavki",
      tone: "neutral",
    },
    {
      label: "Povrati robe",
      value: money(totals.returnValue),
      context: `${MONEY2.format(totals.returnedQuantity)} jedinica vraćeno`,
      tone: "danger",
    },
    {
      label: "Korekcije",
      value: money(totals.correctionValue),
      context: "storno, odobrenja, korekcije cene",
      tone: "warning",
    },
    {
      label: "Neto promet",
      value: money(totals.net),
      context:
        change === null
          ? "nema uporednog perioda"
          : `${change > 0 ? "+" : ""}${change}% u odnosu na prethodni period`,
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
      value: money(averageInvoice(totals.net, invoiceCount)),
      context: "neto po dokumentu",
      tone: "info",
    },
    {
      label: "Koncentracija top 10",
      value:
        concentration(byCustomer) === null
          ? "—"
          : `${concentration(byCustomer)}%`,
      context: "udeo najvećih kupaca",
      tone: "warning",
    },
  ];

  return (
    <>
      <SalesLimitNotice lines={lines} />
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
          {money(totals.unknownNegativeValue)}: {UNKNOWN_NEGATIVE_LABEL}. Ulaze u
          neto promet, ali se ne pripisuju ni povratu ni korekciji.
        </p>
      ) : null}
    </>
  );
}

const BROJ = new Intl.NumberFormat("sr-Latn-RS");

/**
 * Upozorenje kada je upit dostigao granicu učitanih stavki.
 *
 * Tada zbirovi i liste na ekranu pokrivaju samo NAJNOVIJE stavke, ne ceo
 * izabrani period. Ekran to mora da kaže, umesto da prikaže skraćen zbir kao
 * da je potpun. Logika upita se ovde ne menja.
 */
export function SalesLimitNotice({
  lines,
  hint = "Izaberite kraći period da biste videli potpune iznose.",
}: {
  lines: SalesLine[];
  /** Šta korisnik na tom ekranu može da uradi da vidi potpune iznose. */
  hint?: string;
}) {
  if (lines.length < SALES_LINES_LIMIT) return null;
  const datumi = lines.map((line) => String(line.issuedOn)).sort();
  return (
    <p className="portal-data-note" data-tone="warning" role="status">
      <strong>Prikaz nije potpun.</strong> Učitano je najnovijih{" "}
      {BROJ.format(SALES_LINES_LIMIT)} stavki ({datumi[0]} –{" "}
      {datumi[datumi.length - 1]}).
      Zbirovi i liste ne obuhvataju starije stavke. {hint}
    </p>
  );
}

export function SalesBreakdown({
  lines,
  view,
  drillDownBase,
}: {
  lines: SalesLine[];
  view: GroupView;
  /** Osnova za drill-down; kada je zadata, red vodi na fakture. */
  drillDownBase?: string;
}) {
  const grouped = summarizeBy(lines, keyFor(view));
  const totals = summarize(lines);

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
              view === "kupci" && drillDownBase
                ? customerIdFor(lines, row.label)
                : null;
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
              <td className="portal-table-number">
                {new Set(lines.map((line) => line.invoiceId)).size}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Poslednji nivo drill-down-a: pojedinačne stavke faktura. */
export function SalesLines({ lines }: { lines: SalesLine[] }) {
  const PRIKAZ = 500;
  return (
    <>
      {lines.length > PRIKAZ ? (
        <p className="portal-data-note">
          Prikazano je najnovijih {BROJ.format(PRIKAZ)} od{" "}
          {BROJ.format(lines.length)} učitanih stavki. Za ostale suzite filtere
          ili preuzmite izvoz.
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
