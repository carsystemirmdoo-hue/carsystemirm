import { percent, quantity } from "@/lib/ordering/panelFormat.mjs";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { countPriceRules, listPriceRules } from "@/lib/pricing/rule-service";
import { resolvePricingScope } from "@/lib/pricing/pricing-scope";
import { pendingBatches } from "@/lib/pricing/rebate-coverage-service";
import { RuleTable } from "../RuleTable";
import { BatchDecision } from "./BatchDecision";
import type { PriceRuleStatus } from "@/db/schema";

export const dynamic = "force-dynamic";

/**
 * Red čekanja odluka.
 *
 * Namerno prikazuje TRI grupe zajedno: ono što čeka odobrenje, ono što je
 * odobreno a nije upisano u BizniSoft, i ono kod čega upis nije potvrđen.
 * Razdvojeni ekrani bi značili da srednja grupa — odobreno pa zaboravljeno —
 * nema svoje mesto, a upravo ona je tihi otkaz koji ovaj model treba da hvata.
 */
export default async function PriceApprovalPage() {
  /*
   * Kapija je UŽA od `view:cene`.
   *
   * Ranije je red čekanja odluka bio otvoren svakome ko vidi cene — dakle i
   * komercijalisti sa paketom `cene_predlog`, koji ovde nema šta da radi.
   * Postflight audit, F-2.
   */
  const user = await requireCapability(
    "view:cene_odobravanje",
    "/portal/cene/odobravanje",
  );
  const canDecide = can(user, "prices:approve") || can(user, "prices:apply");
  const scope = await resolvePricingScope(user);

  /*
   * „Odobreno" se deli na dve grupe. Pravila koja traže upis u BizniSoft su
   * posao kancelarije; pravila koja važe SAMO u portalu (serija iz istorije
   * faktura, `biznisoft_entry_required = false`) nikad se ne upisuju. Ranije su
   * bila zajedno pod „čeka upis", i to samo prvih 200 od 2.948 (kopija 8. 10.),
   * pa se pravo čekanje upisa nije videlo.
   */
  const approvedStatus = { statuses: ["approved_pending_biznisoft"] as PriceRuleStatus[] };
  const [waiting, approved, portalOnly, recorded, failed, counts] = await Promise.all([
    listPriceRules(scope, { statuses: ["pending_approval"] }),
    listPriceRules(scope, { ...approvedStatus, biznisoftEntryRequired: true }),
    listPriceRules(scope, { ...approvedStatus, biznisoftEntryRequired: false, limit: 100 }),
    listPriceRules(scope, { statuses: ["office_recorded"] }),
    listPriceRules(scope, { statuses: ["reconciliation_failed"] }),
    Promise.all([
      countPriceRules(scope, { statuses: ["pending_approval"] }),
      countPriceRules(scope, { ...approvedStatus, biznisoftEntryRequired: true }),
      countPriceRules(scope, { ...approvedStatus, biznisoftEntryRequired: false }),
      countPriceRules(scope, { statuses: ["office_recorded"] }),
      countPriceRules(scope, { statuses: ["reconciliation_failed"] }),
    ]),
  ]);
  const [nWaiting, nApproved, nPortalOnly, nRecorded, nFailed] = counts;
  /** „(N)" ili „(prikazano X od N)" kada je lista skraćena. */
  const broj = (shown: number, total: number) =>
    shown < total ? `prikazano ${quantity(shown)} od ${quantity(total)}` : quantity(total);
  const batches = await pendingBatches(user);

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Odobravanje cena"
        description="Predlozi rabata koji čekaju Vašu odluku. Odobreno pravilo odmah važi u portalu."
      />

      {batches.length ? (
        <section className="portal-panel">
          <h2>Paketi predloga ({batches.length})</h2>
          <p>Grupni i višestruki predlozi jednog kupca. Paket se odobrava ili odbija ceo; pojedinačna pravila su i dalje u tabeli ispod.</p>
          <div className="portal-table-wrap">
            <table className="portal-table rr-table">
              <thead>
                <tr>
                  <th scope="col">Kupac</th>
                  <th scope="col">Predlog</th>
                  <th scope="col">Predložio</th>
                  <th scope="col">Odluka</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={`${b.batch}|${b.customer}`}>
                    <th scope="row">
                      {b.customer}
                      <small>{b.batch}</small>
                    </th>
                    <td>
                      {b.n} pravila · {Number(b.min) === Number(b.max) ? percent(Number(b.min)) : `${quantity(Number(b.min))}–${percent(Number(b.max))}`}
                      <small>{b.replaces ? `menja ${b.replaces} važećih pravila` : "samo nova pravila"}</small>
                    </td>
                    <td>{b.proposer}</td>
                    <td>{canDecide ? <BatchDecision batchId={b.batch} count={b.n} /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <RuleTable rows={waiting} showActions={canDecide} title={`Čeka odobrenje (${broj(waiting.length, nWaiting)})`} />

      {/* 2026-11-11 (vlasnik): bez API-ja ka BizniSoftu nema koraka „čeka upis“ — odobreno važi. */}
      <details className="rr-approved-list">
        <summary className="portal-panel">
          <b>Odobreno — važi ({broj(approved.length + portalOnly.length + recorded.length, nApproved + nPortalOnly + nRecorded)})</b>
          <span>Pravila koja već važe. Kliknite da otvorite listu; opoziv je u redu pravila.</span>
        </summary>
        <RuleTable
          rows={[...approved, ...recorded, ...portalOnly]}
          showActions={canDecide}
          title={`Odobreno — važi (${broj(approved.length + portalOnly.length + recorded.length, nApproved + nPortalOnly + nRecorded)})`}
          description={
            portalOnly.length < nPortalOnly
              ? `Od pravila iz serija (npr. rabati iz istorije faktura) prikazano je najnovijih ${quantity(portalOnly.length)} od ${quantity(nPortalOnly)}; sva pravila sa filterom po kupcu su u Istoriji pravila.`
              : undefined
          }
        />
      </details>

      {nFailed > 0 ? (
        <RuleTable
          rows={failed}
          showActions={canDecide}
          accent="danger"
          title={`Usaglašavanje nije uspelo (${broj(failed.length, nFailed)})`}
          description="Uslov na fakturi se razlikuje od odobrenog u portalu."
        />
      ) : null}
    </>
  );
}
