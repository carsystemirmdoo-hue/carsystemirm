import Link from "next/link";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { Metric, PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { loadDataState, ORIGIN_LABELS } from "@/lib/data-state/data-state";
import { resolveLedgerScope } from "@/lib/ledger/effective-sales";
import {
  can,
  landingRouteFor,
  navGroupsFor,
  PERMISSION_PACKAGES,
  ROLE_LABELS,
  seesAllCustomers,
} from "@/lib/authz/permissions.mjs";
import { requireUser } from "@/lib/authz/session";
import { BackupStatusPanel } from "@/features/portal/BackupStatusPanel";
import { loadBackupStatus } from "@/lib/backup/status-service";
import { dmy, dmyTime } from "@/lib/ordering/panelFormat.mjs";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const user = await requireUser("/portal");

  // Magacioner nema početnu stranu. Umesto 403 na adresi na koju prijava
  // podrazumevano vodi, otvara se prvi ekran koji sme da vidi.
  if (!can(user, "view:home")) redirect(landingRouteFor(user));

  const groups = navGroupsFor(user);
  const packages = PERMISSION_PACKAGES.filter((item) =>
    user.permissions.includes(item.key),
  );

  const scope = await resolveLedgerScope(user);
  const state = await loadDataState(scope);
  const scoped = !seesAllCustomers(user);
  const showSignals = can(user, "view:preporuke");
  const accounts = can(user, "customer_accounts:manage") ? await accountCounts() : null;
  const hasDocs = state.confirmedDocuments > 0;
  const demo = state.dataset.kind === "demo";
  // Upozorenje o kopijama vide oni koji prate sinhronizaciju (vlasnik, kancelarija).
  const backups = can(user, "sync:monitor") ? await loadBackupStatus() : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Pregled"
        title={`Dobar dan, ${user.name.split(" ")[0]}`}
        description={
          scoped
            ? `Prijavljeni ste kao ${ROLE_LABELS[user.role]}. Brojke ispod se odnose samo na Vaše dodeljene kupce.`
            : `Prijavljeni ste kao ${ROLE_LABELS[user.role]}. Brojke ispod se odnose na sve kupce.`
        }
      />

      {backups !== undefined ? <BackupStatusPanel items={backups} compact /> : null}

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Stanje podataka</h2>
            <p>
              {demo
                ? "Lokalni demo: izmišljeni kupci i kupovine. Ovo nije BizniSoft uvoz."
                : "Potvrđeni prodajni dokumenti iz BizniSoft uvoza — ista osnova kao na kartici kupca i u preporukama."}
            </p>
          </div>
        </div>
        {hasDocs ? (
          <div className="portal-metrics">
            <Metric
              label={scoped ? "Dokumenti Vaših kupaca" : "Potvrđeni dokumenti"}
              value={formatCount(state.confirmedDocuments)}
              context={demo ? "izmišljeno" : undefined}
              tone={demo ? "warning" : "neutral"}
            />
            <Metric
              label="Kupci sa kupovinom"
              value={formatCount(state.customersWithDocuments)}
            />
            <Metric
              label="Poslednji dokument"
              value={formatDate(state.lastIssuedOn)}
              context={`prvi: ${formatDate(state.firstIssuedOn)}`}
            />
            <Metric
              label={demo ? "Podaci upisani" : "Poslednji uvoz"}
              value={state.lastIngestedAt ? formatDateTime(state.lastIngestedAt) : "—"}
            />
          </div>
        ) : null}
        <div className="portal-panel-body">
          {hasDocs ? (
            <p>
              Poreklo:{" "}
              {demo
                ? `${state.dataset.kind === "demo" ? state.dataset.label : ""} — nije BizniSoft.`
                : Object.entries(state.byOrigin)
                    .map(([origin, n]) => `${ORIGIN_LABELS[origin as keyof typeof ORIGIN_LABELS] ?? origin}: ${formatCount(n ?? 0)}`)
                    .join(" · ")}
              {state.allInvoices > state.confirmedDocuments
                ? `. Bez potvrđenog izvornog dokumenta: ${formatCount(state.allInvoices - state.confirmedDocuments)}; takve fakture ne ulaze u kartice ni preporuke.`
                : ""}
            </p>
          ) : (
            <p>
              {scoped
                ? "Za Vaše dodeljene kupce još nema potvrđenih prodajnih dokumenata."
                : "U sistemu još nema potvrđenih prodajnih dokumenata. Prve brojke se pojavljuju posle uvoza BizniSoft faktura (ručno ili preko konektora)."}
            </p>
          )}
          <p className="portal-footnote">
            Naplata i dugovanja se ne prikazuju: izvor uplata i datuma dospeća nije povezan.
          </p>
        </div>
      </section>

      {showSignals && hasDocs ? (
        <section className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>Za razgovor</h2>
              <p>
                {state.recommendations.asOfDate
                  ? `Obračun preporuka na dan ${formatDate(state.recommendations.asOfDate)} Svaki signal se meri prema ritmu tog kupca i artikla.`
                  : "Preporuke još nisu obračunate."}
              </p>
            </div>
          </div>
          {state.recommendations.asOfDate ? (
            <div className="portal-metrics">
              <Link className="portal-metric-link" href="/portal/za-razgovor">
                <Metric
                  label="Kupci za razgovor"
                  value={formatCount(state.recommendations.customersNeedingAttention)}
                  context="imaju artikal van ritma"
                  tone={state.recommendations.customersNeedingAttention ? "warning" : "success"}
                />
              </Link>
              <Link className="portal-metric-link" href="/portal/preporuke?status=overdue">
                <Metric
                  label="Artikli koji kasne"
                  value={formatCount(state.recommendations.articlesOverdue)}
                  context="prošao uobičajeni termin"
                  tone={state.recommendations.articlesOverdue ? "warning" : "neutral"}
                />
              </Link>
              <Link className="portal-metric-link" href="/portal/preporuke?status=dormant">
                <Metric
                  label="Duže ne uzimaju"
                  value={formatCount(state.recommendations.articlesDormant)}
                  context="ranije redovno"
                  tone={state.recommendations.articlesDormant ? "danger" : "neutral"}
                />
              </Link>
            </div>
          ) : null}
        </section>
      ) : null}

      {accounts ? (
        <section className="portal-panel">
          <div className="portal-section-header">
            <div>
              <h2>Nalozi kupaca</h2>
              <p>Poziv se izdaje tek kada su firma i ovlašćena osoba potvrđene.</p>
            </div>
            <Link className="portal-section-link" href="/portal/kupci/nalozi">
              Otvorite naloge
            </Link>
          </div>
          <div className="portal-metrics">
            <Metric label="Čekaju potvrdu osobe" value={formatCount(accounts.awaitingVerification)} tone={accounts.awaitingVerification ? "warning" : "neutral"} />
            <Metric label="Poziv izdat" value={formatCount(accounts.invited)} />
            <Metric label="Aktivni" value={formatCount(accounts.active)} tone="success" />
          </div>
        </section>
      ) : null}

      <details className="portal-panel portal-access-details">
        <summary>Vaš pristup i ekrani koje možete da otvorite</summary>
        <div className="portal-panel-body">
          <p>
            Uloga određuje osnovni pristup, a paketi dozvola ga proširuju. Dodelu menja Vlasnik kroz
            Korisnike i dozvole.{" "}
            {packages.length > 0
              ? `Dodatni paketi: ${packages.map((item) => item.name).join(", ")}.`
              : "Nemate dodatnih paketa."}
          </p>
          <ul className="portal-plain-list">
            {groups.map((group) => (
              <li key={group.label}>
                <strong>{group.label}:</strong>{" "}
                {group.items.map((item, index) => (
                  <span key={item.href}>
                    {index ? ", " : ""}
                    <Link href={item.href}>{item.label}</Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      </details>
    </>
  );
}

const nf = new Intl.NumberFormat("sr-Latn-RS");
function formatCount(n: number) {
  return nf.format(n);
}
function formatDate(iso: string | null) {
  if (!iso) return "—";
  return dmy(iso.slice(0, 10));
}
function formatDateTime(at: Date) {
  return dmyTime(at);
}

/** Stanja kupčevih naloga — samo brojevi, bez adresa. */
async function accountCounts() {
  const rows = await getDb().execute<{ awaiting: number; invited: number; active: number }>(sql`
    SELECT count(*) FILTER (WHERE u.status IN ('requested', 'approved') AND v.id IS NULL)::int AS awaiting,
           count(*) FILTER (WHERE u.status = 'approved')::int AS invited,
           count(*) FILTER (WHERE u.status = 'active')::int AS active
      FROM customer_users u
      LEFT JOIN customer_contact_verifications v
        ON v.customer_user_id = u.id AND v.revoked_at IS NULL`);
  const r = [...rows][0];
  return { awaitingVerification: r?.awaiting ?? 0, invited: r?.invited ?? 0, active: r?.active ?? 0 };
}
