import { PageHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { listPriceRules } from "@/lib/pricing/rule-service";
import { RuleTable } from "../RuleTable";

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
  const user = await requireCapability("view:cene", "/portal/cene/odobravanje");
  const canDecide = can(user, "prices:approve") || can(user, "prices:apply");

  const [waiting, approved, failed] = await Promise.all([
    listPriceRules({ statuses: ["pending_approval"] }),
    listPriceRules({ statuses: ["approved_pending_biznisoft"] }),
    listPriceRules({ statuses: ["reconciliation_failed"] }),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Finansije"
        title="Odobravanje cena"
        description="Odobrenje nije potvrda. Pravilo postaje potvrđeno tek kada kancelarija evidentira da je uslov upisan u BizniSoft."
      />

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
