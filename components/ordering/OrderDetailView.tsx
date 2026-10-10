import Link from "next/link";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { OrderStage } from "@/components/ordering/OrderStatusBadge";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import type { OrderDetail } from "@/lib/ordering/ordering-service";
import { publicSiteOpen } from "@/lib/site-mode";
import { ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";
import { amount, dmyTime, money, percent, quantity } from "@/lib/ordering/panelFormat.mjs";
import { orderStage } from "@/lib/ordering/statusView.mjs";
import { versionDiff } from "@/lib/ordering/versionDiff.mjs";

type Audience = "customer" | "office";

function eventText(e: OrderDetail["events"][number]) {
  if (e.kind === "submitted") return "Zahtev poslat";
  if (e.kind === "biznisoft_recorded") return e.reason ?? "Uneto u BizniSoft";
  if (e.kind === "replaced") return e.reason ?? "Poslata ispravka";
  const to = ORDER_STATUS_LABELS[e.toStatus as keyof typeof ORDER_STATUS_LABELS] ?? e.toStatus;
  return `Status: ${to}`;
}

const numberOf = (v: { requestNumber: string; orderNumber: string | null }) => v.orderNumber ?? v.requestNumber;

/** Zbir zahteva: poznate cene, PDV i ukupno — ili jasno da iznos još nije utvrđen. */
export function OrderTotals({ order }: { order: Pick<OrderDetail, "lines" | "netTotal" | "vatTotal" | "grossTotal" | "onRequestLines" | "currency"> }) {
  const allOnRequest = order.lines.length > 0 && order.lines.every((l) => l.priceStatus === "na_upit");
  const onRequest = order.onRequestLines ?? 0;
  if (allOnRequest) {
    return (
      <div className="pn-card" aria-label="Zbir">
        <h2 className="pn-h2">Zbir</h2>
        <p className="pn-unknown">Iznos još nije utvrđen</p>
        <p className="pn-totals-note">Sve stavke su na upit ({countOf(order.lines.length, STAVKA)}). Cenu potvrđuje kancelarija; nijedna stavka nije besplatna.</p>
      </div>
    );
  }
  return (
    <div className="pn-card" aria-label="Zbir">
      <h2 className="pn-h2">{onRequest ? "Zbir poznatih cena" : "Zbir"}</h2>
      <dl className="pn-totals">
        <dt>Iznos bez PDV-a</dt>
        <dd>{money(order.netTotal, order.currency)}</dd>
        <dt>PDV</dt>
        <dd>{money(order.vatTotal, order.currency)}</dd>
        <dt className="pn-grand">{onRequest ? "Zbir sa PDV-om — nije konačan" : "Ukupno sa PDV-om"}</dt>
        <dd className="pn-grand">{money(order.grossTotal, order.currency)}</dd>
      </dl>
      {onRequest ? (
        <p className="pn-totals-note">
          Nije konačan iznos zahteva: {countOf(onRequest, STAVKA)} na upit nije uračunato. Cenu tih stavki potvrđuje kancelarija.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Zahtev/porudžbina — isti prikaz za kupca i kancelariju.
 *
 * Redosled: stanje i ko je na potezu → radnja → podaci i zbir → stavke (cela
 * širina) → verzije i istorija. Kupac ne vidi imena zaposlenih (vidi
 * „Kancelarija“) ni interni BizniSoft naziv artikla.
 */
export function OrderDetailView({
  order,
  audience,
  previous = null,
  actions = null,
  notice = null,
  headActions = null,
}: {
  order: OrderDetail;
  audience: Audience;
  /** Verzija koju ova zamenjuje (za označene izmene). */
  previous?: OrderDetail | null;
  /** Radnje na potezu (kupac ili kancelarija). */
  actions?: React.ReactNode;
  notice?: React.ReactNode;
  headActions?: React.ReactNode;
}) {
  const office = audience === "office";
  const base = office ? "/portal/zahtevi" : "/kupac/porudzbine";
  const confirmed = order.status === "confirmed";
  const current = order.current && order.current.id !== order.id ? order.current : null;
  const pendingProposal = Boolean(order.replacedBy && order.replacedBy.status === "awaiting_customer");
  const stage = orderStage(order.status, { audience, biznisoftRecorded: Boolean(order.biznisoftDocumentNumber), pendingProposal, oldVersion: Boolean(current) });
  const diff = previous ? versionDiff(previous.lines, order.lines) : null;
  const prevLabel = previous ? `verzijom ${previous.revision} (${previous.requestNumber})` : "";

  return (
    <div className="pn">
      <p className="pn-back">
        <Link href={base}>{office ? "← Zahtevi kupaca" : "← Svi zahtevi i porudžbine"}</Link>
      </p>

      <header className="pn-head">
        <div>
          <h1 className="pn-title">
            {confirmed ? `Porudžbina ${order.orderNumber}` : `Zahtev ${order.requestNumber}`}
            {order.revision > 1 ? <small> · verzija {order.revision}</small> : null}
          </h1>
          <OrderStage status={order.status} audience={audience} biznisoftRecorded={Boolean(order.biznisoftDocumentNumber)} pendingProposal={pendingProposal} oldVersion={Boolean(current)} />
          <p className="pn-lead">
            {confirmed ? <>Iz zahteva {order.requestNumber} · </> : null}
            Poslato {dmyTime(order.submittedAt)} · {order.submittedByName}
            {office ? <> · {order.customerName}</> : null}
          </p>
        </div>
        {headActions ? <div className="pn-head-actions pn-no-print">{headActions}</div> : null}
      </header>

      {current ? (
        <div className="pn-note" data-tone="old" role="note">
          <div className="pn-note-row">
            <span>
              <strong>Stara verzija — samo istorija.</strong> Važeća je {numberOf(current)}. Na ovoj verziji nema radnji.
            </span>
            <Link href={`${base}/${current.id}`} className="pn-btn" data-size="sm">
              Otvorite važeću verziju
            </Link>
          </div>
        </div>
      ) : null}

      {notice}

      {!current && (actions || stage.next) ? (
        <section className="pn-turn-card" data-turn={stage.turn} aria-label="Šta sledi">
          <h2>{stage.title}</h2>
          {stage.next ? <p className="pn-muted" style={{ fontSize: 14 }}>{stage.next}</p> : null}
          {order.statusReason ? (
            <p style={{ fontSize: 14 }}>
              <strong>Razlog kancelarije:</strong> {order.statusReason}
            </p>
          ) : null}
          {actions}
        </section>
      ) : null}

      <div className="pn-split">
        <section className="pn-card" aria-label="Podaci zahteva">
          <dl className="pn-facts">
            {office ? (
              <div>
                <dt>Kupac</dt>
                <dd>
                  {order.customerName}
                  {order.partnerCode ? <small>Šifra partnera {order.partnerCode}</small> : null}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>Opcija plaćanja</dt>
              <dd>
                {order.paymentOptionLabel ?? "Po dogovoru sa kancelarijom"}
                <small>
                  {order.paymentOption === "avans" ? "Cena važi uz uplatu pre isporuke. " : null}
                  Izbor opcije nije dokaz uplate.
                </small>
              </dd>
            </div>
            <div>
              <dt>Kontakt</dt>
              <dd>
                {order.submittedByName}
                {order.contactPhone || order.contactEmail ? <small>{[order.contactPhone, order.contactEmail].filter(Boolean).join(" · ")}</small> : null}
              </dd>
            </div>
            <div>
              <dt>Adresa isporuke</dt>
              <dd>{order.deliveryAddress ?? <span className="pn-muted">Redovna adresa kupca</span>}</dd>
            </div>
            {office || confirmed ? (
              <div>
                <dt>BizniSoft</dt>
                <dd>
                  {order.biznisoftDocumentNumber ?? (confirmed ? "Čeka unos" : "—")}
                  {order.biznisoftRecordedAt ? <small>upisano {dmyTime(order.biznisoftRecordedAt)}</small> : null}
                </dd>
              </div>
            ) : null}
            {order.customerNote ? (
              <div style={{ gridColumn: "1 / -1" }}>
                <dt>Napomena kupca</dt>
                <dd style={{ whiteSpace: "pre-line" }}>{order.customerNote}</dd>
              </div>
            ) : null}
          </dl>
          {order.priceListKind === "demo" ? <p className="pn-note" data-tone="warning">DEMO: izmišljene cene iz demo cenovnika. Ovaj zahtev ne ide u BizniSoft.</p> : null}
        </section>
        <OrderTotals order={order} />
      </div>

      <section className="pn-card pn-card-flush" aria-labelledby="stavke-naslov">
        <div className="pn-card-h">
          <h2 id="stavke-naslov">
            Stavke <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {order.lines.length}</span>
          </h2>
          <span className="pn-small pn-muted">
            {diff && diff.count ? `Izmene u odnosu na ${prevLabel} su označene` : "Cene su po jedinici mere, bez PDV-a"}
          </span>
        </div>
        <ScrollTable label="Stavke zahteva">
          <table className="pn-table pn-table-cards pn-table-sticky">
            <thead>
              <tr>
                <th scope="col">Šifra</th>
                <th scope="col">Naziv</th>
                <th scope="col" className="pn-r">Količina</th>
                <th scope="col" className="pn-r">
                  Cena kupca / JM <span className="pn-th-sub">bez PDV-a</span>
                </th>
                <th scope="col" className="pn-r">
                  Iznos <span className="pn-th-sub">bez PDV-a</span>
                </th>
                <th scope="col" className="pn-r">PDV</th>
                <th scope="col" className="pn-r">
                  Ukupno <span className="pn-th-sub">sa PDV-om</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {order.lines.map((l) => {
                const ch = diff?.changed[l.articleId];
                const onRequest = l.priceStatus === "na_upit";
                return (
                  <tr key={l.lineNumber} data-tone={ch?.added ? "added" : ch ? "warning" : undefined}>
                    <td className="pn-c-code">{l.articleCode}</td>
                    <td className="pn-c-name">
                      {l.catalogSlug && publicSiteOpen() && !office ? (
                        <Link href={`/proizvodi/${l.catalogSlug}${l.catalogVariantId ? `?varijanta=${encodeURIComponent(l.catalogVariantId)}` : ""}`} className="pn-strong">
                          {l.catalogName}
                        </Link>
                      ) : (
                        <span className="pn-strong">{l.catalogName ?? l.articleName}</span>
                      )}
                      {l.variantLabel ? <span className="pn-sub">Varijanta: {l.variantLabel}</span> : null}
                      {/*
                        Kupac vidi kataloški naziv, varijantu i pakovanje; interni BizniSoft
                        naziv vide samo kancelarija i komercijalisti.
                      */}
                      {audience === "office" && l.catalogSlug ? <span className="pn-sub">BizniSoft: {l.articleName}</span> : null}
                      {l.packConfirmed ? <span className="pn-sub">Pakovanje {l.packLabel}</span> : null}
                      {ch?.added ? <span className="pn-tag" data-tone="success">Dodato u ovoj verziji</span> : null}
                      {ch?.quantityFrom !== undefined ? (
                        <span className="pn-tag" data-tone="warning">
                          Količina {quantity(ch.quantityFrom)} → {quantity(l.quantity)}
                        </span>
                      ) : null}
                      {ch?.priceFrom !== undefined ? (
                        <span className="pn-tag" data-tone="warning">
                          Cena {amount(ch.priceFrom)} → {amount(l.netPrice)}
                        </span>
                      ) : null}
                      {ch?.statusFrom ? (
                        <span className="pn-tag" data-tone="warning">{ch.statusFrom === "na_upit" ? "Bilo na upit — sada sa cenom" : "Sada na upit"}</span>
                      ) : null}
                    </td>
                    <td className="pn-r pn-num" data-label="Količina">
                      {quantity(l.quantity)} {l.unit}
                    </td>
                    {onRequest ? (
                      <>
                        <td className="pn-r" data-label="Cena kupca / JM">
                          <span className="pn-onreq">Na upit</span>
                          <span className="pn-sub">{office ? l.onRequestReason ?? "cenu potvrđuje kancelarija" : "cenu potvrđuje kancelarija"}</span>
                        </td>
                        <td className="pn-r pn-muted" data-label="Iznos bez PDV-a">—</td>
                        <td className="pn-r pn-muted pn-hide-phone" data-label="PDV">—</td>
                        <td className="pn-r pn-muted pn-c-total" data-label="Ukupno sa PDV-om">
                          nije utvrđen
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="pn-r" data-label="Cena kupca / JM">
                          <span className="pn-num">
                            {amount(l.netPrice)} <span className="pn-muted">/ {l.unit}</span>
                          </span>
                          {l.listPrice !== null ? (
                            <>
                              <span className="pn-sub pn-num">osnovna {amount(l.listPrice)}</span>
                              <span className="pn-sub pn-num">rabat {percent(l.discountPercent ?? 0)}</span>
                            </>
                          ) : null}
                        </td>
                        <td className="pn-r pn-num" data-label="Iznos bez PDV-a">
                          {amount(l.lineNet)}
                        </td>
                        <td className="pn-r" data-label="PDV">
                          <span className="pn-num">{amount(l.lineVat)}</span>
                          <span className="pn-sub pn-num">{percent(l.vatPercent)}</span>
                        </td>
                        <td className="pn-r pn-num pn-strong pn-c-total" data-label="Ukupno sa PDV-om">
                          {amount(l.lineGross)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </ScrollTable>
        {diff && diff.removed.length ? (
          <div className="pn-card-foot" role="note">
            <strong style={{ color: "var(--p-ink)" }}>Uklonjeno u odnosu na {prevLabel}:</strong>{" "}
            {diff.removed.map((r, i) => (
              <span key={r.articleId}>
                {i ? "; " : ""}
                {r.articleCode} {r.catalogName ?? r.articleName} ({quantity(r.quantity)} {r.unit})
              </span>
            ))}
            . Ove stavke nisu deo ove verzije.
          </div>
        ) : null}
        <p className="pn-card-foot">Iznosi su u RSD. Cena kupca je osnovna cena iz cenovnika umanjena za odobreni rabat, po jedinici mere, bez PDV-a.</p>
      </section>

      <div className="pn-split" style={{ gridTemplateColumns: undefined }}>
        <section className="pn-card" aria-labelledby="istorija-naslov">
          <h2 id="istorija-naslov" className="pn-h2">
            Istorija
          </h2>
          <ol className="pn-history">
            {order.events.map((e, i) => (
              <li key={i}>
                <time>{dmyTime(e.at)}</time>
                <span>
                  <strong>{eventText(e)}</strong>{" "}
                  <span className="pn-who">· {e.staff ? (office ? `Kancelarija · ${e.actor}` : "Kancelarija") : `Kupac · ${e.actor}`}</span>
                  {e.reason && e.kind !== "biznisoft_recorded" && e.kind !== "replaced" ? <span className="pn-why-text">„{e.reason}“</span> : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
        {order.versions.length > 1 ? (
          <section className="pn-card" aria-labelledby="verzije-naslov">
            <h2 id="verzije-naslov" className="pn-h2">
              Verzije
            </h2>
            <ol className="pn-versions">
              {order.versions.map((v) => (
                <li key={v.id} aria-current={v.id === order.id ? "true" : undefined}>
                  <span>
                    {v.id === order.id ? <span className="pn-vname">{numberOf(v)}</span> : <Link href={`${base}/${v.id}`} className="pn-vname">{numberOf(v)}</Link>}
                    <span className="pn-muted pn-small"> · {dmyTime(v.submittedAt)}</span>
                  </span>
                  <span className="pn-inline">
                    <span className="pn-small">{ORDER_STATUS_LABELS[v.status as keyof typeof ORDER_STATUS_LABELS] ?? v.status}</span>
                    {v.current ? <span className="pn-tag" data-tone="success" style={{ marginTop: 0 }}>važeća</span> : null}
                    {v.id === order.id ? <span className="pn-tag" data-tone="neutral" style={{ marginTop: 0 }}>prikazana</span> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </div>
  );
}
