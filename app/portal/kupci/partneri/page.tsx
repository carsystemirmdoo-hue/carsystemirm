import Link from "next/link";
import { Badge, PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { SKIP_REASONS } from "@/lib/partners/assignmentPlan.mjs";
import {
  listSalespersonCodes,
  listSalesReps,
  previewAssignmentPlan,
} from "@/lib/partners/assignment-service";
import { isPartnerRegistryUploadEnabled } from "@/lib/partners/gate";
import {
  listPartnerRegistry,
  listRegistryIssuers,
} from "@/lib/partners/partner-registry-service";
import { LinkPartnerForm, PlanApply, RepCodeForm, UploadForm } from "./RegistryForms";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";
/**
 * Server akcije otpremanja sa ove strane rade u funkciji ove rute.
 * Mora biti broj napisan ovde (Next ga čita statički); jednak je
 * `UPLOAD_ROUTE_MAX_DURATION_S` iz `lib/import/upload-limits.mjs`, što
 * proverava `lib/import/uploadLimits.test.mjs`.
 */
export const maxDuration = 60;

const PIB_LABELS: Record<string, string> = {
  valid: "ispravan",
  invalid_checksum: "kontrolna cifra ne odgovara",
  nonstandard: "nije domaći PIB",
  missing: "nema PIB",
};

const MAX_ROWS = 250;

export default async function PartnerRegistryPage({
  searchParams,
}: {
  searchParams: Promise<{ izdavalac?: string; klasa?: string; q?: string }>;
}) {
  const user = await requireCapability("view:mapiranja", "/portal/kupci/partneri");
  const canLink = can(user, "mappings:manage");
  const canAssign = can(user, "assignments:manage");
  const params = await searchParams;

  const issuers = await listRegistryIssuers();
  const issuerCode =
    params.izdavalac && issuers.includes(params.izdavalac) ? params.izdavalac : (issuers[0] ?? null);
  const registry = issuerCode
    ? await listPartnerRegistry(issuerCode)
    : { latestImport: null, rows: [] };

  const klasa =
    params.klasa === "rep_assigned_candidate" || params.klasa === "needs_review"
      ? params.klasa
      : null;
  const q = (params.q ?? "").trim().toLowerCase();
  const filtered = registry.rows.filter(
    (r) =>
      (!klasa || r.classification === klasa) &&
      (!q ||
        r.partnerCode.toLowerCase() === q ||
        r.name.toLowerCase().includes(q) ||
        (r.pib ?? "").includes(q) ||
        (r.city ?? "").toLowerCase().includes(q)),
  );

  const [plan, reps, repLinks] = await Promise.all([
    canAssign && issuerCode ? previewAssignmentPlan(issuerCode) : Promise.resolve(null),
    canAssign ? listSalesReps() : Promise.resolve([]),
    canAssign ? listSalespersonCodes() : Promise.resolve([]),
  ]);
  const repCodes = [...new Set(registry.rows.map((r) => r.repCode).filter(Boolean))].sort() as string[];
  const summary = (registry.latestImport?.summary ?? null) as Record<string, unknown> | null;
  const skippedByReason = plan
    ? plan.skipped.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.reason]: (acc[s.reason] ?? 0) + 1 }), {})
    : {};

  return (
    <>
      <PageHeader
        eyebrow="Prodaja"
        title="Registar partnera"
        description="Snimak BizniSoft kartica partnera. Registar nije spisak kupaca: šifra komercijaliste na kartici nije dokaz kupovine, a e-pošta sa kartice nije ovlašćen kontakt. Ništa odavde se ne povezuje, ne dodeljuje i ne poziva samo od sebe."
      />

      {canLink ? <UploadForm enabled={isPartnerRegistryUploadEnabled()} /> : null}

      {!registry.latestImport ? (
        <section className="portal-panel">
          <p>Registar još nije uvezen.</p>
        </section>
      ) : (
        <section className="portal-panel">
          <h2>
            Poslednji uvoz · {issuerCode} · {registry.latestImport.fileName}
          </h2>
          <p>
            {dmyTime(new Date(registry.latestImport.importedAt))} ·{" "}
            {String(summary?.partners ?? "?")} partnera · {String(summary?.repAssignedCandidates ?? "?")} sa
            šifrom komercijaliste ({String(summary?.candidatesWithEmail ?? "?")} sa e-poštom iz izvora,{" "}
            {String(summary?.candidatesWithoutEmail ?? "?")} bez) · {String(summary?.needsReview ?? "?")} za
            dodatnu proveru
          </p>
          {Array.isArray(summary?.criticalChanges) && summary.criticalChanges.length > 0 ? (
            <div className="portal-login-error" role="alert">
              <span>
                <strong>PIB promenjen pod istom šifrom</strong>
                <small>Šifre: {(summary.criticalChanges as string[]).join(", ")} — proveriti pre bilo kakve veze.</small>
              </span>
            </div>
          ) : null}
          {issuers.length > 1 ? (
            <p>
              Izdavalac:{" "}
              {issuers.map((i) => (
                <Link key={i} href={`?izdavalac=${encodeURIComponent(i)}`}>
                  {i}{" "}
                </Link>
              ))}
            </p>
          ) : null}
        </section>
      )}

      {canAssign && issuerCode ? (
        <section className="portal-panel">
          <h2>Šifre komercijalista i plan dodela</h2>
          <p>
            Plan dodeljuje kupca komercijalisti samo kada je lanac ceo: šifra partnera povezana sa
            kupcem, šifra komercijaliste povezana sa aktivnim komercijalistom, i sve poslovnice
            istog kupca imaju istog komercijalistu. Postojeće dodele se ne diraju.
          </p>
          <RepCodeForm
            codes={repCodes.map((code) => ({
              code,
              linkedName: repLinks.find((l) => l.sourceCode === code)?.userName ?? null,
            }))}
            reps={reps}
          />
          {plan ? (
            <>
              <p>
                Predloženo novih dodela: <strong>{plan.proposed.length}</strong> · već dodeljeno:{" "}
                {plan.alreadyAssigned.length}
              </p>
              <ul className="portal-plain-list">
                {Object.entries(skippedByReason).map(([reason, n]) => (
                  <li key={reason}>
                    <small>
                      {n} × {SKIP_REASONS[reason as keyof typeof SKIP_REASONS] ?? reason}
                    </small>
                  </li>
                ))}
              </ul>
              <PlanApply issuerCode={issuerCode} disabled={plan.proposed.length === 0} />
            </>
          ) : null}
        </section>
      ) : null}

      {registry.latestImport ? (
        <section className="portal-panel">
          <h2>Partneri ({filtered.length})</h2>
          <form className="portal-inline-form" method="get">
            {issuerCode ? <input type="hidden" name="izdavalac" value={issuerCode} /> : null}
            <select name="klasa" defaultValue={klasa ?? ""} aria-label="Klasifikacija">
              <option value="">Svi</option>
              <option value="rep_assigned_candidate">Sa šifrom komercijaliste (kandidat)</option>
              <option value="needs_review">Za dodatnu proveru</option>
            </select>
            <input type="search" name="q" defaultValue={params.q ?? ""} placeholder="Šifra, naziv, PIB, mesto" aria-label="Pretraga" />
            <button type="submit" className="portal-button" data-variant="primary">Filtrirajte</button>
          </form>
          {filtered.length > MAX_ROWS ? (
            <p className="portal-login-hint">Prikazano prvih {MAX_ROWS}; suzite filter.</p>
          ) : null}
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Šifra</th>
                  <th scope="col">Partner</th>
                  <th scope="col">PIB</th>
                  <th scope="col">Kom.</th>
                  <th scope="col">E-pošta iz izvora</th>
                  <th scope="col">Veza sa kupcem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, MAX_ROWS).map((r) => (
                  <tr key={r.partnerCode}>
                    <td>{r.partnerCode}</td>
                    <td>
                      <strong>{r.name}</strong>
                      <small>{[r.city, r.address].filter(Boolean).join(", ")}</small>
                    </td>
                    <td>
                      {r.pib ?? "—"}
                      {r.pibStatus !== "valid" ? <small>{PIB_LABELS[r.pibStatus] ?? r.pibStatus}</small> : null}
                    </td>
                    <td>{r.repCode ?? "—"}</td>
                    <td>
                      {r.emails && r.emails.length > 0 ? (
                        <>
                          {r.emails.join(", ")}
                          <small>nije potvrđen kontakt</small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {r.identityStatus === "mapped" && r.customerId ? (
                        <Link href={`/portal/kupci/${r.customerId}`}>{r.customerName}</Link>
                      ) : r.identityStatus ? (
                        <Badge tone="warning">{r.identityStatus}</Badge>
                      ) : canLink ? (
                        <LinkPartnerForm
                          issuerCode={issuerCode!}
                          partnerCode={r.partnerCode}
                          canCreate={r.pibStatus === "valid" && !r.samePibCustomerId}
                          attachTo={
                            r.samePibCustomerId
                              ? { id: r.samePibCustomerId, name: r.samePibCustomerName ?? "" }
                              : null
                          }
                        />
                      ) : (
                        <small>nije povezan</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}
