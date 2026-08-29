import { asc } from "drizzle-orm";
import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { customers } from "@/db/schema";
import type { ExternalIdentityStatus } from "@/db/schema/commercial";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  countExternalIdentifiersByStatus,
  listExternalIdentifiers,
} from "@/lib/commercial/identity-service";
import {
  EXTERNAL_IDENTITY_LABELS,
  EXTERNAL_IDENTITY_TONES,
} from "@/lib/portal/status-labels";
import { IdentityResolver } from "./IdentityResolver";

export const dynamic = "force-dynamic";

const STATUSES: ExternalIdentityStatus[] = [
  "unmapped",
  "mapped",
  "conflict",
  "disabled",
];

function parseStatus(raw: string | undefined): ExternalIdentityStatus | undefined {
  return STATUSES.includes(raw as ExternalIdentityStatus)
    ? (raw as ExternalIdentityStatus)
    : undefined;
}

export default async function PartnerCodesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const user = await requireCapability("view:mapiranja", "/portal/kupci/mapiranja");
  const canManage = can(user, "mappings:manage");
  const params = await searchParams;

  const [rows, counts, customerOptions] = await Promise.all([
    listExternalIdentifiers({
      status: parseStatus(params.status),
      search: params.q,
    }),
    countExternalIdentifiersByStatus(),
    getDb()
      .select({ id: customers.id, name: customers.name, pib: customers.pib })
      .from(customers)
      .orderBy(asc(customers.name))
      .limit(1000),
  ]);

  const total = STATUSES.reduce((sum, status) => sum + counts[status], 0);

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Šifre partnera"
        description="Šifra partnera iz BizniSofta je zaseban identitet kupca. Vodeća nula je deo šifre. Povezivanje je uvek ručno — sistem ne spaja po sličnom nazivu ni po PIB-u."
        meta={
          <>
            {STATUSES.map((status) => (
              <Badge key={status} tone={EXTERNAL_IDENTITY_TONES[status]}>
                {EXTERNAL_IDENTITY_LABELS[status]}: {counts[status]}
              </Badge>
            ))}
          </>
        }
      />

      {total === 0 ? (
        <section className="portal-panel">
          <h2>Još nema nijedne šifre partnera</h2>
          <p>
            Šifre se evidentiraju kada stignu iz BizniSoft izvoza. Do tada ovaj
            ekran nema šta da prikaže — i namerno ne prikazuje primer.
          </p>
        </section>
      ) : (
        <>
          <section className="portal-panel">
            <form className="portal-filters" method="get">
              <label className="portal-field">
                <span>Stanje</span>
                <select name="status" defaultValue={params.status ?? ""}>
                  <option value="">Sva stanja</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {EXTERNAL_IDENTITY_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="portal-field">
                <span>Pretraga po šifri ili nazivu</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ""}
                  maxLength={100}
                />
              </label>
              <button className="portal-button" type="submit" data-variant="primary">
                <span>Primeni</span>
              </button>
            </form>
            <p className="portal-login-hint">
              Pretraga je pomoć čoveku pri pregledu. Rezultat pretrage nikada ne
              ulazi u automatsko povezivanje — ono ide isključivo po tačnoj šifri.
            </p>
          </section>

          <IdentityResolver
            rows={rows}
            customers={customerOptions}
            canManage={canManage}
          />
        </>
      )}
    </>
  );
}
