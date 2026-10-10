import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/authz/session";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

/** Nazivi polja koja zahtevi kupaca upisuju u trag (ostala polja su već na srpskom). */
const KEY_LABELS: Record<string, string> = {
  status: "stanje",
  orderNumber: "broj porudžbine",
  biznisoftDocumentNumber: "BizniSoft dokument",
};

/** Vrednost polja: kodovi stanja zahteva kao srpski nazivi, prazno kao „—“, da/ne. */
function formatItem(item: unknown): string {
  if (item === null || item === undefined || item === "") return "—";
  if (typeof item === "boolean") return item ? "da" : "ne";
  const text = String(item);
  return ORDER_STATUS_LABELS[text as keyof typeof ORDER_STATUS_LABELS] ?? text;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${KEY_LABELS[key] ?? key}: ${formatItem(item)}`)
      .join(", ");
  }
  return formatItem(value);
}

/** Radnje nad zahtevima kupaca beleže se kodom (`customer_order.<stanje>`); ostale su već opisne. */
function formatAction(action: string) {
  const m = action.match(/^customer_order\.(\w+)$/);
  if (!m) return action;
  if (m[1] === "biznisoft_recorded") return "Zahtev kupca: upisan broj BizniSoft dokumenta";
  const label = ORDER_STATUS_LABELS[m[1] as keyof typeof ORDER_STATUS_LABELS];
  return label ? `Zahtev kupca: ${label}` : action;
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
                      {dmyTime(row.createdAt)}
                    </td>
                    <td>{row.actorLabel}</td>
                    <td>
                      <strong>{formatAction(row.action)}</strong>
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
