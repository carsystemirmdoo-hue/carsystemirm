import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { sql } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import { customerDebtLines } from "@/lib/sales-tools/receivables-service";

export const metadata = { title: "Dugovanje kupca" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const money = (n: number) => n.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : "—");
const stamp = (s: string) => `${s.slice(8, 10)}.${s.slice(5, 7)}. u ${s.slice(11, 16)}`;

/** Otvorene fakture jednog kupca (2026-11-10). */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await requireCapability("view:dugovanja", `/portal/dugovanja/${id}`);
  const scope = await resolveLedgerScope(user);
  if (scope.customerIds !== null && !scope.customerIds.includes(id)) forbidden();
  const [customer] = [...(await getDb().execute<{ name: string; pib: string }>(sql`SELECT name, pib FROM customers WHERE id = ${id}::uuid`))];
  if (!customer) notFound();
  const { snapshot, lines } = await customerDebtLines(id);
  const total = lines.reduce((s, l) => s + l.remaining, 0);
  const overdue = lines.filter((l) => (l.daysOverdue ?? 0) > 0).reduce((s, l) => s + l.remaining, 0);

  return (
    <>
      <PageHeader
        eyebrow="Dugovanje kupca"
        title={customer.name}
        description={`PIB ${customer.pib}. Fakture iz tabele kancelarije; one kojih nema u tabeli su plaćene.`}
        meta={snapshot ? <span>Stanje iz tabele: provereno {stamp(snapshot.checkedAt)}</span> : undefined}
        actions={
          <>
            <Link className="rr-link" href="/portal/dugovanja">← Dugovanja</Link>
            {can(user, "view:preporuke") ? <Link className="rr-link" href={`/portal/kupci/${id}/preporuke`}>Preporuke i poziv</Link> : null}
          </>
        }
      />
      <div className="dg-metrics">
        <div className="dg-metric"><span>Duguje</span><strong>{money(total)} RSD</strong></div>
        <div className="dg-metric dg-metric--late"><span>Dospelo</span><strong>{money(overdue)} RSD</strong></div>
        <div className="dg-metric"><span>Otvorenih faktura</span><strong>{lines.length}</strong></div>
      </div>
      <section className="portal-panel">
        <div className="portal-table-wrap">
          <table className="portal-table dg-lines">
            <thead>
              <tr><th>Faktura</th><th>Datum</th><th>Valuta</th><th className="pk-num">Iznos</th><th className="pk-num">Uplaćeno</th><th className="pk-num">Ostatak</th></tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td data-label="Faktura">{l.invoiceNumber ?? "—"}{l.note ? <span className="portal-table-sub">{l.note}</span> : null}</td>
                  <td data-label="Datum">{dmy(l.issuedOn)}</td>
                  <td data-label="Valuta">
                    {dmy(l.dueOn)}
                    {l.daysOverdue !== null && l.daysOverdue > 0 ? <span className="pk-late"> · kasni {l.daysOverdue} d</span> : null}
                  </td>
                  <td className="pk-num" data-label="Iznos">{l.amount === null ? "—" : money(l.amount)}</td>
                  <td className="pk-num" data-label="Uplaćeno">{l.paid === null ? "—" : money(l.paid)}</td>
                  <td className="pk-num" data-label="Ostatak"><b>{money(l.remaining)}</b></td>
                </tr>
              ))}
              {lines.length === 0 ? <tr><td colSpan={6}>{snapshot ? "Nema otvorenih faktura." : "Tabela dugovanja još nije povezana."}</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
