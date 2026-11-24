import Link from "next/link";
import { Badge } from "@/components/portal/PortalPrimitives";
import type { CustomerStockRequestRow } from "@/lib/stock/stock-requests";

const qty = new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 3 });
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

export const arrived = (r: CustomerStockRequestRow) => r.stockNow !== null && r.stockNow > 0;

/** Tabela zapisa jednog kupca (ili bez kupca): šta je tražio, kada, i ima li ga sada. */
export function TrazenoTable({ rows }: { rows: CustomerStockRequestRow[] }) {
  return (
    <div className="portal-table-wrap">
      <table className="portal-table" data-sort="off">
        <thead>
          <tr>
            <th scope="col">Artikal</th>
            <th scope="col" className="portal-table-number">Količina</th>
            <th scope="col">Tražio</th>
            <th scope="col">Izvor</th>
            <th scope="col" className="portal-table-number">Lager sada</th>
            <th scope="col">Napomena</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row">
                {r.name}
                <small className="portal-table-sub"> · {r.code}</small>
              </th>
              <td className="portal-table-number">{r.quantity === null ? "—" : `${qty.format(r.quantity)} ${r.unit ?? ""}`}</td>
              <td>{dmy(r.createdAt)}</td>
              <td>{r.source === "porudzbina" ? `porudžbina ${r.orderNumber ?? ""}` : `ručno${r.requestedBy ? ` (${r.requestedBy})` : ""}`}</td>
              <td className="portal-table-number">
                {arrived(r) ? (
                  <Badge tone="success">stiglo: {qty.format(r.stockNow!)} — javite kupcu</Badge>
                ) : r.stockNow === null ? (
                  "—"
                ) : (
                  <Badge tone="warning">nema</Badge>
                )}
              </td>
              <td>{r.note ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Grupisano po kupcu; kupci kod kojih je nešto stiglo idu prvi. */
export function TrazenoPoKupcima({ rows }: { rows: CustomerStockRequestRow[] }) {
  const groups = new Map<string, { id: string | null; name: string; rows: CustomerStockRequestRow[] }>();
  for (const r of rows) {
    const key = r.customerId ?? "";
    const g = groups.get(key) ?? { id: r.customerId, name: r.customerName ?? "Bez kupca (upit telefonom)", rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  const list = [...groups.values()].sort(
    (a, b) =>
      Number(b.rows.some(arrived)) - Number(a.rows.some(arrived)) ||
      Number(a.id === null) - Number(b.id === null) ||
      a.name.localeCompare(b.name, "sr"),
  );
  return (
    <>
      {list.map((g) => {
        const n = g.rows.filter(arrived).length;
        return (
          <section className="portal-panel" key={g.id ?? "bez-kupca"}>
            <div className="portal-section-header">
              <div>
                <h2>{g.id ? <Link href={`/portal/kupci/${g.id}`}>{g.name}</Link> : g.name}</h2>
                <p>
                  {g.rows.length} {g.rows.length === 1 ? "artikal" : "artikala"}
                  {n ? ` · stiglo ${n} — javite kupcu` : ""}
                </p>
              </div>
            </div>
            <TrazenoTable rows={g.rows} />
          </section>
        );
      })}
    </>
  );
}
