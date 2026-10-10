import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listPriceRules } from "@/lib/pricing/rule-service";
import { resolvePricingScope } from "@/lib/pricing/pricing-scope";
import { pendingBatches } from "@/lib/pricing/rebate-coverage-service";
import { RuleTable } from "../RuleTable";
import { BatchDecision } from "./BatchDecision";

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

  const [waiting, approved, recorded, failed] = await Promise.all([
    listPriceRules(scope, { statuses: ["pending_approval"] }),
    listPriceRules(scope, { statuses: ["approved_pending_biznisoft"] }),
    listPriceRules(scope, { statuses: ["office_recorded"] }),
    listPriceRules(scope, { statuses: ["reconciliation_failed"] }),
  ]);
  const batches = await pendingBatches(user);

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Odobravanje cena"
        description="Odobrenje nije potvrda. Pravilo postaje potvrđeno tek kada kancelarija evidentira da je uslov upisan u BizniSoft."
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
                      {b.n} pravila · {Number(b.min) === Number(b.max) ? `${Number(b.min)} %` : `${Number(b.min)}–${Number(b.max)} %`}
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

      <section className="portal-panel">
        <h2>Čeka odobrenje ({waiting.length})</h2>
      </section>
      <RuleTable rows={waiting} showActions={canDecide} />

      <section className="portal-panel" data-accent="warning">
        <h2>Odobreno — čeka upis u BizniSoft ({approved.length})</h2>
        <p>
          Ova pravila već učestvuju u odlučivanju o ceni, ali NISU potvrđena kao
          fakturisani uslov. Dok upis ne bude evidentiran, cena nije garantovana.
        </p>
      </section>
      <RuleTable rows={approved} showActions={canDecide} />

      <section className="portal-panel">
        <h2>Evidentiran unos — čeka usaglašavanje sa fakturom ({recorded.length})</h2>
        <p>
          Kancelarija je evidentirala unos u BizniSoft. To je tvrdnja čoveka, ne
          dokaz — potvrdu daje tek usaglašavanje sa fakturom.
        </p>
      </section>
      <RuleTable rows={recorded} showActions={canDecide} />

      {failed.length > 0 ? (
        <>
          <section className="portal-panel" data-accent="danger">
            <h2>Usaglašavanje nije uspelo ({failed.length})</h2>
            <p>
              Odobreno u portalu, a upis u BizniSoft nije potvrđen. Ovo je jedino
              stanje u kome portal i knjigovodstvo tvrde različite stvari.
            </p>
          </section>
          <RuleTable rows={failed} showActions={canDecide} />
        </>
      ) : null}
    </>
  );
}
