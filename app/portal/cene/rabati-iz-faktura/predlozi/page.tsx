import Link from "next/link";
import { srDate } from "@/components/customer/account-format";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can, seesAllCustomers } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { rebateProposals } from "@/lib/pricing/rebate-application-service";
import { OUTCOME_LABELS } from "@/lib/pricing/rebateApplication.mjs";
import { PROPOSAL_RULES } from "@/lib/pricing/rebateProposalEvidence.mjs";
import { belgradeDate } from "@/lib/recommendations/customerRhythm.mjs";
import { pct } from "../format";
import { ProposeArticleButton } from "./ProposeArticleButton";

export const dynamic = "force-dynamic";
const SHOWN = 200;
const UNASSIGNED = "Bez dodele — vlasnik";
const VERDICT: Record<string, { label: string; tone: string }> = {
  jak_dokaz: { label: "Jak dokaz", tone: "success" },
  nedovoljan_dokaz: { label: "Nedovoljan dokaz", tone: "warning" },
  odluka_nadleznog: { label: "Razlika sa odobrenim pravilom", tone: "danger" },
};

/**
 * Predlozi rabata sa dokazima: parovi bez odobrenog pravila (sa rabatom na
 * fakturi u poslednjih 6 meseci) koji nisu ispunili stroga merila, i parovi gde
 * poslednja faktura odstupa od ODOBRENOG pravila. Ništa se ne primenjuje samo;
 * „Predložite“ šalje u Odobravanje cena. Porodica (prva reč naziva) je samo
 * pomoćni dokaz. Komercijalista vidi samo svoje kupce.
 */
export default async function RebateProposalsPage({ searchParams }: { searchParams: Promise<{ ocena?: string; komercijalista?: string }> }) {
  const user = await requireCapability("view:rabati", "/portal/cene/rabati-iz-faktura/predlozi");
  const sp = await searchParams;
  const ocena = sp.ocena && sp.ocena in VERDICT ? sp.ocena : "sve";
  const komercijalista = (sp.komercijalista ?? "").slice(0, 120);
  const all = await rebateProposals(user, belgradeDate(new Date()));
  const owner = (e: (typeof all)[number]) => (e.salespeople.length ? e.salespeople.join(", ") : UNASSIGNED);
  const owners = [...new Set(all.map(owner))].sort((a, b) => (a === UNASSIGNED ? 1 : b === UNASSIGNED ? -1 : a.localeCompare(b, "sr-Latn")));
  const filtered = all
    .filter((e) => (ocena === "sve" || e.verdict === ocena) && (!komercijalista || owner(e) === komercijalista))
    .sort((a, b) => owner(a).localeCompare(owner(b), "sr-Latn") || a.customerName.localeCompare(b.customerName, "sr-Latn") || a.articleCode.localeCompare(b.articleCode));
  const canPropose = can(user, "prices:propose");
  return (
    <>
      <CrumbLabel segment="predlozi" label="Predlozi sa dokazima" />
      <PageHeader
        eyebrow="Finansije · Rabati iz faktura"
        title="Predlozi rabata sa dokazima"
        description="Parovi kupac–artikal bez odobrenog rabata (kupac zato vidi „cena na upit“) i parovi gde poslednja faktura odstupa od odobrenog pravila. Ništa ovde ne menja cenu; predlog ide na odobrenje vlasniku."
        meta={
          <span>
            {seesAllCustomers(user) ? "Svi kupci." : "Vaši dodeljeni kupci."} Jak dokaz: poslednja faktura ≤ {PROPOSAL_RULES.pairMaxAgeDays} dana, isti rabat u
            fakturama porodice (12 meseci, ≥ {PROPOSAL_RULES.familyMinLines} stavki) i u odobrenim pravilima porodice (≥ {PROPOSAL_RULES.familyMinRules}), oba ≥ {Math.round(PROPOSAL_RULES.familyShare * 100)} %, bez izuzetaka. Porodica = prva reč naziva (pomoćni dokaz).
          </span>
        }
        actions={<Link className="rr-link" href="/portal/cene/rabati-iz-faktura/za-pregled">Za pregled (stroga merila) →</Link>}
      />
      <section className="portal-metrics rr-metrics" aria-label="Po komercijalisti">
        {owners.map((o) => {
          const l = all.filter((e) => owner(e) === o);
          return (
            <div key={o} className="portal-metric" data-tone={o === UNASSIGNED ? "warning" : "neutral"}>
              <span className="portal-metric-label">{o}</span>
              <strong className="portal-metric-value">{l.length}</strong>
              <small className="portal-metric-context">
                {Object.entries(VERDICT).map(([k, v]) => `${l.filter((e) => e.verdict === k).length} ${v.label.toLowerCase()}`).join(" · ")}
              </small>
            </div>
          );
        })}
      </section>
      <section className="portal-panel">
        <form method="get" className="rr-filters" aria-label="Filteri">
          <label>
            <span>Ocena</span>
            <select name="ocena" defaultValue={ocena}>
              <option value="sve">Sve ({all.length})</option>
              {Object.entries(VERDICT).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({all.filter((e) => e.verdict === k).length})</option>
              ))}
            </select>
          </label>
          {owners.length > 1 ? (
            <label>
              <span>Nadležan</span>
              <select name="komercijalista" defaultValue={komercijalista}>
                <option value="">Svi</option>
                {owners.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          ) : null}
          <button type="submit">Prikažite</button>
        </form>
        <div className="portal-table-wrap">
          <table className="portal-table rr-table">
            <thead>
              <tr>
                <th scope="col">Kupac</th>
                <th scope="col">Artikal</th>
                <th scope="col">Predlog i ocena</th>
                <th scope="col">Poslednje fakture</th>
                <th scope="col">Porodica</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, SHOWN).map((e) => {
                const v = VERDICT[e.verdict];
                return (
                  <tr key={`${e.customerId}|${e.articleId}`}>
                    <th scope="row">
                      <Link href={`/portal/cene/rabati-iz-faktura/kupci/${e.customerId}?artikli=pregled#artikli`}>{e.customerName}</Link>
                      <small>{owner(e)}</small>
                    </th>
                    <td>
                      {e.articleCode}
                      <small>{e.articleName ?? ""}</small>
                    </td>
                    <td>
                      <span className="kk-status" data-tone={v.tone}>{v.label}</span>
                      <small>
                        {e.kind === "razlika_sa_odobrenim"
                          ? `Odobreno ${e.approvedPercent?.map((p) => pct(p)).join(", ")}, poslednja faktura ${e.evidence.proposedPercent === null ? "—" : pct(e.evidence.proposedPercent)}. Odobreno pravilo se ne prepisuje.`
                          : `Predlog ${e.evidence.proposedPercent === null ? "—" : pct(e.evidence.proposedPercent)} · ${OUTCOME_LABELS[e.outcome as keyof typeof OUTCOME_LABELS] ?? e.outcome}`}
                      </small>
                      {e.evidence.reasons.length ? <small>{e.evidence.reasons.join(" · ")}</small> : null}
                      {canPropose && e.kind === "bez_pravila" && e.evidence.proposedPercent ? (
                        <ProposeArticleButton customerId={e.customerId} articleId={e.articleId} percent={e.evidence.proposedPercent} />
                      ) : null}
                    </td>
                    <td>
                      {e.evidence.lastInvoices.map((i, k) => (
                        <small key={k}>
                          {i.documentLabel} · {srDate(i.issuedOn)} · {i.percent === null ? "mešano" : pct(i.percent)}
                        </small>
                      ))}
                    </td>
                    <td>
                      <small>„{e.evidence.family ?? "—"}“</small>
                      <small>fakture 12 m: {e.evidence.familyInvoices.n ? `${Math.round(e.evidence.familyInvoices.share * 100)} % = ${pct(e.evidence.familyInvoices.value ?? 0)} (${e.evidence.familyInvoices.n})` : "nema"}</small>
                      <small>pravila: {e.evidence.familyRules.n ? `${Math.round(e.evidence.familyRules.share * 100)} % = ${pct(e.evidence.familyRules.value ?? 0)} (${e.evidence.familyRules.n})` : "nema"}</small>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>Nema predloga za izabrane filtere.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {filtered.length > SHOWN ? <p className="portal-data-note">Prikazano {SHOWN} od {filtered.length}. Suzite ocenu ili nadležnog.</p> : null}
      </section>
    </>
  );
}
