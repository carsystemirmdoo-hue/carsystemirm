import Link from "next/link";
import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { Badge, PageHeader, SectionHeader } from "@/components/portal/PortalPrimitives";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { dmy, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { currentStockSnapshot, stockDisplayPolicy } from "@/lib/stock/stock-import-service";

export const dynamic = "force-dynamic";

const day = (iso: string | null) => (iso ? dmy(new Date(`${iso}T12:00:00Z`)) : "—");

export default async function Page() {
  const user = await requireCapability("view:zalihe", "/portal/zalihe");
  const [current, policy] = await Promise.all([currentStockSnapshot(), stockDisplayPolicy()]);
  const canImport = can(user, "imports:write");
  const envOn = process.env.STOCK_CUSTOMER_DISPLAY === "1";

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
        <SectionHeader title="Prikaz kupcima" description="Prijavljeni kupci vide stanje tek kada se uključe obe brave i zada prag zastarelosti." />
        <dl className="pl-facts">
          <div><dt>Okruženje</dt><dd>{envOn ? <Badge tone="warning">dozvoljeno</Badge> : <Badge tone="neutral">isključeno</Badge>}</dd></div>
          <div><dt>Podešavanje vlasnika</dt><dd>{policy.enabled ? <Badge tone="warning">uključeno</Badge> : <Badge tone="neutral">isključeno</Badge>}</dd></div>
          <div><dt>Prag zastarelosti</dt><dd>{policy.maxAgeDays === null ? "nije zadat — bez praga nema prikaza" : `${policy.maxAgeDays} dana od datuma stanja`}</dd></div>
        </dl>
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
