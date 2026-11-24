import { and, count, desc, ilike, or, sql, type SQL } from "drizzle-orm";
import Link from "next/link";
import { DateRangeField } from "@/components/portal/DateRangeField";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { auditLog } from "@/db/schema";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { ROLE_LABELS } from "@/lib/authz/permissions.mjs";
import { ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";


export const metadata = { title: "Aktivnosti" };

export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

/** Nazivi polja koja zahtevi kupaca upisuju u trag (ostala polja su već na srpskom). */
const KEY_LABELS: Record<string, string> = {
  status: "stanje",
  orderNumber: "broj porudžbine",
  biznisoftDocumentNumber: "BizniSoft dokument",
};

/**
 * Vrednost polja: kodovi stanja zahteva kao srpski nazivi, prazno kao „—“,
 * da/ne, ISO datum kao dd/mm/gggg. Ugnježđen objekat i niz se ispisuju
 * sadržajem — ranije je stajalo „[object Object]“ (npr. zbir cenovnika).
 */
function formatItem(item: unknown): string {
  if (item === null || item === undefined || item === "") return "—";
  if (typeof item === "boolean") return item ? "da" : "ne";
  if (Array.isArray(item)) return item.length ? item.map(formatItem).join("; ") : "—";
  if (typeof item === "object") {
    const parts = Object.entries(item as Record<string, unknown>).map(([k, v]) => `${KEY_LABELS[k] ?? k} ${formatItem(v)}`);
    return parts.length ? `(${parts.join(", ")})` : "—";
  }
  const text = String(item);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return dmy(text);
  return ORDER_STATUS_LABELS[text as keyof typeof ORDER_STATUS_LABELS] ?? text;
}

/** „Ime (gazda)“ → „Ime (Vlasnik)“: uloga u tragu je upisana kodom. */
function formatActor(label: string): string {
  return label.replace(/\((\w+)\)$/, (whole, role: string) => {
    const name = ROLE_LABELS[role as keyof typeof ROLE_LABELS];
    return name ? `(${name})` : whole;
  });
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

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; strana?: string }>;
}) {
  await requireCapability("view:aktivnosti", "/portal/aktivnosti");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const from = params.from && ISO.test(params.from) ? params.from : "";
  const to = params.to && ISO.test(params.to) ? params.to : "";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(params.strana ?? "1", 10) || 1));

  /*
   * Pretraga i period. Ranije je ekran pokazivao samo poslednjih 100 od
   * desetina hiljada zapisa (kopija 8. 10.: 31.272), bez načina da se nađe
   * starija radnja. Džokeri iz unosa se izbegavaju.
   */
  const conditions: SQL[] = [];
  if (q) {
    const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(
      or(
        ilike(auditLog.actorLabel, pattern),
        ilike(auditLog.action, pattern),
        ilike(auditLog.entityType, pattern),
        ilike(auditLog.entityLabel, pattern),
        ilike(auditLog.reason, pattern),
      )!,
    );
  }
  // Datumi su dani u Beogradu; granica „do“ uključuje ceo dan.
  if (from) conditions.push(sql`(${auditLog.createdAt} AT TIME ZONE 'Europe/Belgrade')::date >= ${from}::date`);
  if (to) conditions.push(sql`(${auditLog.createdAt} AT TIME ZONE 'Europe/Belgrade')::date <= ${to}::date`);
  const where = conditions.length ? and(...conditions) : undefined;

  const db = getDb();
  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(auditLog).where(where),
  ]);
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = (page - 1) * PAGE_SIZE + rows.length;
  const link = (n: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (from) u.set("from", from);
    if (to) u.set("to", to);
    if (n > 1) u.set("strana", String(n));
    const qs = u.toString();
    return `/portal/aktivnosti${qs ? `?${qs}` : ""}`;
  };

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
            <h2>
              Zapisi {quantity(first)}–{quantity(last)} od {quantity(total)}
            </h2>
            <p>
              Najnoviji prvi. Ispravka se unosi kao nov zapis sa razlogom, a ne izmenom
              postojećeg.
            </p>
          </div>
        </div>
        <form method="get" className="portal-settings-form">
          <label>
            <span>Pretraga</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              maxLength={100}
              placeholder="Izvršilac, radnja, šifra, kupac ili razlog"
            />
          </label>
          <DateRangeField nameOd="from" nameDo="to" defaultOd={from} defaultDo={to} />
          <button type="submit" className="portal-button" data-variant="primary">
            Prikažite
          </button>
        </form>

        {rows.length === 0 ? (
          <div className="portal-phase-notice">
            <p className="portal-phase-notice-tag">
              {q || from || to
                ? "Nijedan zapis ne odgovara pretrazi i periodu."
                : "Još nema zapisa. Prvi će se pojaviti čim neko promeni ulogu, dozvolu ili sistemski prag."}
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
                    <td className="portal-nowrap">{dmyTime(row.createdAt)}</td>
                    <td className="portal-cell-wrap">{formatActor(row.actorLabel)}</td>
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
        {total > PAGE_SIZE ? (
          <p className="portal-pagination">
            {page > 1 ? <Link href={link(page - 1)}>← Novije</Link> : null}{" "}
            {last < total ? <Link href={link(page + 1)}>Starije →</Link> : null}
          </p>
        ) : null}
      </section>
    </>
  );
}
