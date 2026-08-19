import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${key}: ${String(item)}`)
      .join(", ");
  }
  return String(value);
}

export default async function AuditLogPage() {
  await requireCapability("view:aktivnosti", "/portal/aktivnosti");

  const rows = await getDb()
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(PAGE_SIZE);

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Aktivnosti"
        description="Trag revizije važnih poslovnih radnji. Zapisi se samo dodaju — ne mogu se izmeniti ni obrisati, ni kroz aplikaciju ni direktno u bazi."
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Poslednjih {PAGE_SIZE} zapisa</h2>
            <p>
              Ispravka se unosi kao nov zapis sa razlogom, a ne izmenom
              postojećeg.
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="portal-phase-notice">
            <p className="portal-phase-notice-tag">
              Još nema zapisa. Prvi će se pojaviti čim neko promeni ulogu,
              dozvolu ili sistemski prag.
            </p>
          </div>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Vreme</th>
                  <th scope="col">Izvršilac</th>
                  <th scope="col">Radnja</th>
                  <th scope="col">Entitet</th>
                  <th scope="col">Pre</th>
                  <th scope="col">Posle</th>
                  <th scope="col">Razlog</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      {new Intl.DateTimeFormat("sr-Latn-RS", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(row.createdAt)}
                    </td>
                    <td>{row.actorLabel}</td>
                    <td>
                      <strong>{row.action}</strong>
                    </td>
                    <td>
                      {row.entityType}
                      {row.entityLabel ? (
                        <small>{row.entityLabel}</small>
                      ) : null}
                    </td>
                    <td>{formatValue(row.valueBefore)}</td>
                    <td>{formatValue(row.valueAfter)}</td>
                    <td>{row.reason ?? "—"}</td>
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
