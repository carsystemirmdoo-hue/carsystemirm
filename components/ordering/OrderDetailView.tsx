import Link from "next/link";
import { srDateTime, srMoney } from "@/components/customer/account-format";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import type { OrderDetail } from "@/lib/ordering/ordering-service";
import { ORDER_STATUS_HELP, ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";

const qfmt = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });

function eventText(e: OrderDetail["events"][number]) {
  if (e.kind === "submitted") return "Zahtev poslat";
  if (e.kind === "biznisoft_recorded") return e.reason ?? "Uneto u BizniSoft";
  if (e.kind === "replaced") return e.reason ?? "Poslata ispravka";
  const to = ORDER_STATUS_LABELS[e.toStatus as keyof typeof ORDER_STATUS_LABELS] ?? e.toStatus;
  return `Status: ${to}`;
}

/**
 * Zahtev/porudžbina — isti prikaz za kupca i kancelariju.
 *
 * Kupac ne vidi imena zaposlenih (vidi „Kancelarija") ni osnov cene; vidi
 * šta je poslato, po kojoj ceni, i u kom je stanju.
 */
export function OrderDetailView({ order, audience }: { order: OrderDetail; audience: "customer" | "office" }) {
  const base = audience === "office" ? "/portal/zahtevi" : "/kupac/porudzbine";
  const money = (n: number) => srMoney(String(n), order.currency);
  const confirmed = order.status === "confirmed";
  return (
    <>
      <div className="kk-order-head">
        <div>
          <span className="ka-eyebrow">{confirmed ? "Potvrđena porudžbina" : "Zahtev za porudžbinu"}</span>
          <h2>{confirmed ? order.orderNumber : order.requestNumber}</h2>
          <p>
            {confirmed ? <>Iz zahteva {order.requestNumber} · </> : null}
            Poslato {srDateTime(order.submittedAt)} · {order.submittedByName}
            {audience === "office" ? <> · {order.customerName}</> : null}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="kk-state" data-status={order.status}>
        <p>{ORDER_STATUS_HELP[order.status as keyof typeof ORDER_STATUS_HELP]}</p>
        {order.replaces ? (
          <p>
            Ispravka zahteva <Link href={`${base}/${order.replaces.id}`}>{order.replaces.requestNumber}</Link>.
          </p>
        ) : null}
        {order.replacedBy ? (
          <p>
            Ispravljen zahtev poslat je kao <Link href={`${base}/${order.replacedBy.id}`}>{order.replacedBy.requestNumber}</Link>.
          </p>
        ) : null}
        {order.statusReason ? (
          <p>
            <strong>Razlog kancelarije:</strong> {order.statusReason}
          </p>
        ) : null}
        {order.priceListKind === "demo" ? (
          <p className="kk-demo-note">DEMO: izmišljene cene iz demo cenovnika. Ovaj zahtev ne ide u BizniSoft.</p>
        ) : null}
      </div>

      <dl className="ka-facts ka-facts-wide">
        <div><dt>Osnovica (bez PDV-a)</dt><dd>{money(order.netTotal)}</dd></div>
        <div><dt>PDV</dt><dd>{money(order.vatTotal)}</dd></div>
        <div><dt>Ukupno sa PDV-om</dt><dd>{money(order.grossTotal)}</dd></div>
        <div>
          <dt>BizniSoft</dt>
          <dd>
            {order.biznisoftDocumentNumber ?? (confirmed ? "čeka unos" : "—")}
            {order.biznisoftRecordedAt ? <small>upisano {srDateTime(order.biznisoftRecordedAt)}</small> : null}
          </dd>
        </div>
      </dl>

      <div className="portal-panel-body">
        <h3>Stavke ({order.lines.length})</h3>
        <ol className="kk-lines kk-lines-static">
          <li className="kk-lines-head" aria-hidden="true">
            <span>Artikal</span>
            <span>Pakovanje</span>
            <span>Količina</span>
            <span>Cena bez PDV-a</span>
            <span>PDV</span>
            <span>Ukupno</span>
          </li>
          {order.lines.map((l) => (
            <li key={l.lineNumber}>
              <span className="kk-name">
                <span>
                  <Link href={`/proizvodi/${l.catalogSlug}${l.catalogVariantId ? `?varijanta=${encodeURIComponent(l.catalogVariantId)}` : ""}`}>
                    {l.catalogName}
                  </Link>
                  <small>
                    Šifra {l.articleCode} · {l.articleName}
                  </small>
                  {audience === "office" ? <small>Osnov cene: {l.priceBasis}</small> : null}
                </span>
              </span>
              <span data-label="Pakovanje">
                {l.packLabel}
                <small>JM: {l.unit}</small>
              </span>
              <span data-label="Količina">{qfmt.format(l.quantity)}</span>
              <span data-label="Cena bez PDV-a">
                {money(l.netPrice)}
                {l.discountPercent ? <small>cenovnik {money(l.listPrice)} − {qfmt.format(l.discountPercent)} %</small> : null}
              </span>
              <span data-label="PDV">
                {money(l.lineVat)}
                <small>{qfmt.format(l.vatPercent)} %</small>
              </span>
              <span data-label="Ukupno" className="ka-amount">
                {money(l.lineGross)}
                <small>bez PDV-a {money(l.lineNet)}</small>
              </span>
            </li>
          ))}
        </ol>
        {order.customerNote ? (
          <p className="kk-customer-note">
            <strong>Napomena kupca:</strong> {order.customerNote}
          </p>
        ) : null}

        <h3>Istorija</h3>
        <ol className="kk-timeline">
          {order.events.map((e, i) => (
            <li key={i}>
              <time>{srDateTime(e.at)}</time>
              <span>
                <strong>{eventText(e)}</strong> · {e.staff ? (audience === "office" ? e.actor : "Kancelarija") : e.actor}
                {e.reason && e.kind !== "biznisoft_recorded" && e.kind !== "replaced" ? <small>{e.reason}</small> : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
