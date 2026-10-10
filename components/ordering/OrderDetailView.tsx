import Link from "next/link";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { srDateTime, srMoney } from "@/components/customer/account-format";
import { OrderStatusBadge } from "@/components/ordering/OrderStatusBadge";
import type { OrderDetail } from "@/lib/ordering/ordering-service";
import { publicSiteOpen } from "@/lib/site-mode";
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
  const money = (n: number | null) => (n === null ? "—" : srMoney(String(n), order.currency));
  const confirmed = order.status === "confirmed";
  return (
    <>
      <div className="kk-order-head">
        <div>
          <span className="ka-eyebrow">{confirmed ? "Potvrđena porudžbina" : "Zahtev za porudžbinu"}</span>
          <h2>
            {confirmed ? order.orderNumber : order.requestNumber}
            {order.revision > 1 ? <small> · verzija {order.revision}</small> : null}
          </h2>
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
            {order.replacedBy.status === "cancelled" ? "Odbijen predlog: " : order.replacedBy.status === "awaiting_customer" ? "Predlog koji čeka potvrdu kupca: " : "Važeća verzija: "}
            <Link href={`${base}/${order.replacedBy.id}`}>{order.replacedBy.requestNumber}</Link>.
          </p>
        ) : null}
        {order.statusReason ? (
          <p>
            <strong>Razlog kancelarije:</strong> {order.statusReason}
          </p>
        ) : null}
        {order.paymentOptionLabel ? (
          <p>
            <strong>Plaćanje:</strong> {order.paymentOptionLabel}
            {order.paymentOption === "avans" ? " — cena važi uz uplatu pre isporuke; kancelarija proverava uplatu pre potvrde isporuke." : "."}
            {" "}Izbor opcije nije dokaz uplate.
          </p>
        ) : null}
        {order.onRequestLines ? (
          <p>
            <strong>Stavke na upit: {order.onRequestLines}.</strong> Za njih još nema potvrđene cene; nisu u zbiru. Cenu potvrđuje kancelarija.
          </p>
        ) : null}
        {order.priceListKind === "demo" ? (
          <p className="kk-demo-note">DEMO: izmišljene cene iz demo cenovnika. Ovaj zahtev ne ide u BizniSoft.</p>
        ) : null}
      </div>

      <dl className="ka-facts ka-facts-wide">
        <div><dt>Osnovica (bez PDV-a)</dt><dd>{money(order.netTotal)}</dd></div>
        <div><dt>PDV</dt><dd>{money(order.vatTotal)}</dd></div>
        <div><dt>{order.onRequestLines ? "Zbir stavki sa poznatom cenom — nije konačan iznos zahteva" : "Ukupno sa PDV-om"}</dt><dd>{money(order.grossTotal)}{order.onRequestLines ? <small>sa PDV-om · nije uračunato na upit: {countOf(order.onRequestLines, STAVKA)}</small> : null}</dd></div>
        {order.deliveryAddress ? <div><dt>Adresa isporuke</dt><dd>{order.deliveryAddress}</dd></div> : null}
        {order.contactPhone || order.contactEmail ? <div><dt>Kontakt</dt><dd>{[order.contactPhone, order.contactEmail].filter(Boolean).join(" · ")}</dd></div> : null}
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
            <span>JM / pakovanje</span>
            <span>Količina</span>
            <span>Cena bez PDV-a</span>
            <span>PDV</span>
            <span>Ukupno</span>
          </li>
          {order.lines.map((l) => (
            <li key={l.lineNumber}>
              <span className="kk-name">
                <span>
                  {l.catalogSlug && publicSiteOpen() ? (
                    <Link href={`/proizvodi/${l.catalogSlug}${l.catalogVariantId ? `?varijanta=${encodeURIComponent(l.catalogVariantId)}` : ""}`}>
                      {l.catalogName}
                    </Link>
                  ) : (
                    <strong>{l.catalogName ?? l.articleName}</strong>
                  )}
                  {l.variantLabel ? <small>Varijanta: {l.variantLabel}</small> : null}
                  {/*
                    Kupac vidi kataloški naziv, varijantu, pakovanje i šifru sa svojih
                    faktura; interni BizniSoft naziv vide samo kancelarija i komercijalisti.
                  */}
                  <small>
                    Šifra {l.articleCode}
                    {audience === "office" && l.catalogSlug ? <> · BizniSoft: {l.articleName}</> : null}
                  </small>
                </span>
              </span>
              <span data-label="JM / pakovanje">
                {l.packConfirmed ? l.packLabel : l.unit}
                {l.packConfirmed ? <small>JM: {l.unit}</small> : null}
              </span>
              <span data-label="Količina">{qfmt.format(l.quantity)}</span>
              {l.priceStatus === "na_upit" ? (
                <span data-label="Cena" className="kk-on-request">
                  Na upit
                  <small>{audience === "office" ? l.onRequestReason ?? "cenu potvrđuje kancelarija" : "cenu potvrđuje kancelarija"}</small>
                </span>
              ) : (
                <>
                  <span data-label="Cena bez PDV-a">
                    {money(l.netPrice)}
                    {l.discountPercent ? <small>cenovnik {money(l.listPrice)} − {qfmt.format(l.discountPercent)} %</small> : null}
                  </span>
                  <span data-label="PDV">
                    {money(l.lineVat)}
                    <small>{l.vatPercent === null ? "—" : qfmt.format(l.vatPercent)} %</small>
                  </span>
                  <span data-label="Ukupno" className="ka-amount">
                    {money(l.lineGross)}
                    <small>bez PDV-a {money(l.lineNet)}</small>
                  </span>
                </>
              )}
            </li>
          ))}
        </ol>
        <p className="kk-lines-note">Cene su po jedinici mere (JM), bez PDV-a.</p>
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
