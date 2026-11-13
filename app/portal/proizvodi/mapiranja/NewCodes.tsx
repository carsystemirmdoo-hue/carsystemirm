import Link from "next/link";
import { PRODUCT_MAPPING_LABELS } from "@/lib/portal/status-labels";
import type { NewCodeRow } from "@/lib/catalog/new-codes";

const qty = new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 3 });
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** „Nove šifre“ (2026-11-13): nove šifre iz šifarnika (60 dana) i šifre iz lagera kojih u šifarniku nema. */
export function NewCodes({ rows, days }: { rows: NewCodeRow[]; days: number }) {
  const open = rows.filter((r) => r.source === "lager" || (!r.outOfProgramme && r.mapping !== "mapped"));
  return (
    <details className="portal-panel" id="nove-sifre" open={open.length > 0}>
      <summary>
        <strong>Nove šifre</strong> · {open.length} za razvrstavanje{rows.length !== open.length ? ` (od ${rows.length})` : ""}
      </summary>
      <div className="portal-panel-body">
        <p className="portal-footnote">
          Šifre koje su se prvi put pojavile u poslednjih {days} dana (iz faktura ili uvoza), i šifre iz važećeg lagera kojih u
          šifarniku portala još nema. Šifru iz šifarnika povežite u tabeli ispod (klik na šifru je pronalazi); šifra iz lagera
          ulazi u šifarnik sa prvom fakturom ili uvozom šifarnika.
        </p>
      </div>
      {rows.length === 0 ? (
        <p className="portal-panel-body">Nema novih šifara.</p>
      ) : (
        <div className="portal-table-wrap">
          <table className="portal-table">
            <thead>
              <tr>
                <th scope="col">Šifra</th>
                <th scope="col">Naziv</th>
                <th scope="col">Prvi put</th>
                <th scope="col">Stanje</th>
                <th scope="col">Lager</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key}>
                  <td>
                    {r.articleId ? <Link href={`/portal/proizvodi/mapiranja?q=${encodeURIComponent(r.code)}`}>{r.code}</Link> : r.code}
                  </td>
                  <th scope="row">{r.name}</th>
                  <td>{r.firstSeen ? dmy(r.firstSeen) : "u lageru"}</td>
                  <td>
                    {r.source === "lager"
                      ? "nema u šifarniku"
                      : r.outOfProgramme
                        ? "van programa"
                        : PRODUCT_MAPPING_LABELS[r.mapping ?? "unmapped"] ?? r.mapping}
                  </td>
                  <td className="portal-table-number">{r.stock === null ? "—" : qty.format(r.stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
