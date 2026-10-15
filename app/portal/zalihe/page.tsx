import Link from "next/link";
import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { Badge, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { StockDisplayToggle } from "@/features/portal/StockDisplayToggle";
import { customerDisplayDecision } from "@/lib/stock/displayPolicy.mjs";
import { currentStockSnapshot, stockDisplayPolicy } from "@/lib/stock/stock-import-service";


export const metadata = { title: "Zalihe" };

export const dynamic = "force-dynamic";

const day = (iso: string | null) => (iso ? dmy(new Date(`${iso}T12:00:00Z`)) : "—");

export default async function Page() {
  const user = await requireCapability("view:zalihe", "/portal/zalihe");
  const [current, policy] = await Promise.all([currentStockSnapshot(), stockDisplayPolicy()]);
  const canImport = can(user, "imports:write");
  const envOff = process.env.STOCK_CUSTOMER_DISPLAY === "0";
  const canToggle = can(user, "settings:manage");
  const decision = customerDisplayDecision({
    env: process.env,
    policy: { enabled: true, maxAgeHours: policy.maxAgeHours ?? 24 },
    snapshot: current?.stockDate ? { stockDate: current.stockDate } : null,
    now: new Date(),
  });

  return (
    <>
      <PageHeader
        eyebrow="Logistika"
        title="Zalihe"
        description="Stanje iz poslednjeg potvrđenog izvoza lagera (BizniSoft, 021 VELEPRODAJA)."
        meta={canImport ? <Link href="/portal/zalihe/uvoz">Uvoz lagera →</Link> : undefined}
      />

      <section className="portal-panel">
        <SectionHeader title="Važeći snimak" description="Ručno otpremljen i potvrđen izvoz izveštaja „Stanje zaliha“. To je knjižno stanje iz izvoza, ne garantovana raspoloživost." />
        {current ? (
          <dl className="pl-facts">
            <div><dt>Stanje na dan</dt><dd>{day(current.stockDate)} (iz izveštaja; vreme izvoza nije navedeno)</dd></div>
            <div><dt>Datum štampe</dt><dd>{day(current.printedOn)}</dd></div>
            <div><dt>Potvrđeno</dt><dd>{current.confirmedAt ? dmyTime(current.confirmedAt) : "—"}</dd></div>
            <div><dt>Stavki</dt><dd>{quantity(current.lineCount)}{canImport ? <> · <Link href={`/portal/zalihe/uvoz/${current.id}`}>pregled</Link></> : null}</dd></div>
          </dl>
        ) : (
          <p className="portal-empty">Još nema potvrđenog izvoza lagera.{canImport ? <> <Link href="/portal/zalihe/uvoz">Otpremite prvi.</Link></> : null}</p>
        )}
      </section>

      <section className="portal-panel">
        <SectionHeader
          title="Prikaz kupcima"
          description="Svi prijavljeni kupci vide stanje iz važećeg snimka: broj celih pakovanja samo za proizvode sa potvrđenom vezom i pakovanjem, ostalo „Raspoloživost na upit“. Napomena kupcu: raspoloživost potvrđuje kancelarija."
        />
        <div className="portal-panel-body">
          <dl className="pl-facts">
            <div><dt>Prikaz</dt><dd>{envOff ? <Badge tone="danger">isključen u okruženju</Badge> : policy.enabled ? <Badge tone="success">uključen</Badge> : <Badge tone="neutral">isključen</Badge>}</dd></div>
            <div><dt>Prag svežine</dt><dd>{policy.maxAgeHours ?? 24} h od vremena stanja (izvoz ima samo datum → od početka tog dana)</dd></div>
            <div>
              <dt>Važeći snimak za kupce</dt>
              <dd>
                {!current
                  ? "nema potvrđenog snimka — kupci ne vide stanje"
                  : decision.show
                    ? `brojevi vidljivi do ${dmyTime(decision.validUntil)}`
                    : decision.reason === "zastareo_snimak"
                      ? "stariji od praga — kupci vide „potrebna je provera raspoloživosti“; otpremite i potvrdite današnji izvoz"
                      : "—"}
              </dd>
            </div>
          </dl>
          {canToggle && !envOff ? <StockDisplayToggle enabled={policy.enabled} /> : null}
        </div>
      </section>

      <PhaseNotice
        icon="package"
        title="Šta još ne postoji"
        summary="Istorija dana bez zalihe i automatsko preuzimanje izvoza preko Windows konektora dolaze u sledećoj fazi."
        requires={[
          "Automatsko preuzimanje izvoza sa kancelarijskog računara preko konektora (sledeća faza).",
          "Istorija dana bez zalihe — bez nje preporuka nabavke ostaje označena kao nepouzdana.",
        ]}
        availability="Sledeća faza"
      />
    </>
  );
}
