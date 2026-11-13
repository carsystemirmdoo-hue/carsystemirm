import Link from "next/link";
import { notFound } from "next/navigation";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { requireCapability } from "@/lib/authz/session";
import { loadOrderRequest } from "@/lib/ordering/ordering-service";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";
import { amount, dmyTime, quantity } from "@/lib/ordering/panelFormat.mjs";
import { companyContact } from "@/lib/company-contact";
import { AutoPrint } from "./AutoPrint";
import { PrintButton } from "./PrintButton";
import "./stampa.css";
import { isSinglePiece } from "@/lib/ordering/packRule.mjs";
import { loadOrderPrintParty } from "@/lib/ordering/print-party";

/** Količina sa tri decimale, kao na fakturi (6,000). */
const quantity3 = (v: number) => (Number.isFinite(v) ? v.toLocaleString("sr-RS", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : "—");

export const dynamic = "force-dynamic";

/**
 * „Zahtev za porudžbinu“ / „Potvrđena porudžbina“ za štampu (A4) — Tamara ga
 * prepisuje u BizniSoft. NIJE faktura.
 *
 * U štampi nema navigacije ni dugmadi. Zaglavlje tabele se ponavlja na svakoj
 * strani; broj dokumenta, verzija i „Strana X od Y“ su u margini svake strane
 * (Chrome/Edge štampa, i PDF iz njih). Stara verzija je označena i na svakoj strani.
 */
export default async function OrderPrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const autoPrint = (await searchParams).stampaj === "1";
  const user = await requireCapability("view:zahtevi", `/portal/zahtevi/${encodeURIComponent(id)}/stampa`);
  const o = await loadOrderRequest(user, id);
  if (!o) notFound();
  const priced = o.lines.filter((l) => l.priceStatus === "cena");
  const onRequest = o.lines.filter((l) => l.priceStatus === "na_upit");
  const old = o.current && o.current.id !== o.id ? o.current : null;
  const confirmed = o.status === "confirmed" && o.orderNumber;
  const title = confirmed ? "Potvrđena porudžbina" : "Zahtev za porudžbinu";
  const docShort = `${confirmed ? o.orderNumber : o.requestNumber}${o.revision > 1 ? ` · verzija ${o.revision}` : ""}`;
  // Ista stopa PDV-a na svim stavkama → bez kolone; stopa se navodi uz zbir.
  const party = await loadOrderPrintParty(o.customerId);
  // Specifikacija poreza po stopi, kao na fakturi.
  const vatBreakdown = [...new Set(priced.map((l) => l.vatPercent))].map((rate) => {
    const rows = priced.filter((l) => l.vatPercent === rate);
    const sum = (k: "lineNet" | "lineVat" | "lineGross") => rows.reduce((a, l) => a + (l[k] ?? 0), 0);
    return { rate, net: sum("lineNet"), vat: sum("lineVat"), gross: sum("lineGross") };
  });
  // Rabat = vrednost po osnovnoj ceni − vrednost po ceni kupca (bez PDV-a), kao red „Rabat“ na fakturi.
  const discountTotal = priced.reduce((a, l) => a + (l.listPrice !== null ? l.listPrice * l.quantity : 0) - (l.lineNet ?? 0), 0);
  const margin = `${title} ${docShort}`;
  const pageCss = [
    `@page { @bottom-left { content: ${JSON.stringify(margin)}; font: 8pt Arial, sans-serif; color: #333; }`,
    ` @bottom-right { content: "Strana " counter(page) " od " counter(pages); font: 8pt Arial, sans-serif; color: #333; }`,
    old ? ` @top-center { content: ${JSON.stringify(`STARA VERZIJA — važeća je ${old.orderNumber ?? old.requestNumber}. Ne koristiti za unos.`)}; font: bold 9pt Arial, sans-serif; color: #000; }` : "",
    ` }`,
    // Prva strana već ima istaknut okvir „STARA VERZIJA“ — u margini samo od druge strane.
    old ? ` @page :first { @top-center { content: none; } }` : "",
  ].join("");

  return (
    <>
      <CrumbLabel segment={o.id} label={o.orderNumber ?? o.requestNumber} />
      <CrumbLabel segment="stampa" label="Štampa" />
      <div className="pn zp-screen-only">
        <p className="pn-back">
          <Link href={`/portal/zahtevi/${o.id}`}>← Nazad na zahtev</Link>
        </p>
        <div className="pn-head">
          <div>
            <h1 className="pn-title">Štampa A4 · {docShort}</h1>
            <p className="pn-lead">Za PDF u dijalogu štampe izaberite čuvanje kao PDF. Ispod je pregled lista; navigacija i dugmad se ne štampaju.</p>
          </div>
          <div className="pn-head-actions">
            <PrintButton />
          </div>
        </div>
        {old ? (
          <div className="pn-note" data-tone="old" role="note">
            <div className="pn-note-row">
              <span>
                <strong>Stara verzija.</strong> Važeća je {old.orderNumber ?? old.requestNumber}; odštampani list nosi oznaku stare verzije na svakoj strani.
              </span>
              <Link href={`/portal/zahtevi/${old.id}/stampa`} className="pn-btn" data-size="sm">
                Štampa važeće verzije
              </Link>
            </div>
          </div>
        ) : null}
      </div>
      <AutoPrint enabled={autoPrint} />
      <style>{pageCss}</style>
      <article className="zp-doc" aria-label={title} data-old={old ? "true" : undefined}>
        {old ? (
          <p className="zp-old">
            STARA VERZIJA — zamenjena verzijom {old.orderNumber ?? old.requestNumber}. Ne koristiti za unos u BizniSoft.
          </p>
        ) : null}
        {/* Raspored kao na fakturi iz BizniSofta (vlasnik 2026-11-13): firma gore desno, broj u sredini, kupac u okviru. */}
        <header className="zp-top">
          <div className="zp-firmblock">
            <strong>{companyContact.legalName.toUpperCase()}</strong>
            <span>{companyContact.streetAddress.toUpperCase()}</span>
            <span>
              {companyContact.postalCode} {companyContact.city.toUpperCase()}
            </span>
            <span>PIB: {companyContact.pib}</span>
            <span>Matični broj: {companyContact.mb}</span>
            <span>Telefon: {companyContact.phone}</span>
          </div>
        </header>
        <div className="zp-titlerow">
          <span>Operater: {o.preparedByName ?? "—"}</span>
          <h1>
            {title} br. {confirmed ? o.orderNumber : o.requestNumber}
          </h1>
        </div>
        <section className="zp-meta">
          <dl>
            <div>
              <dt>Datum zahteva</dt>
              <dd>{dmyTime(o.submittedAt)}</dd>
            </div>
            {confirmed ? (
              <div>
                <dt>Broj zahteva</dt>
                <dd>{o.requestNumber}</dd>
              </div>
            ) : null}
            <div>
              <dt>Verzija</dt>
              <dd>
                {o.revision}
                {old ? " (stara)" : o.versions.length > 1 ? " (važeća)" : ""}
              </dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] ?? o.status}</dd>
            </div>
            <div>
              <dt>Komercijalista</dt>
              <dd>{party.salespeople.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt>Dostava</dt>
              <dd>{o.deliveryAddress ?? "redovna adresa kupca"}</dd>
            </div>
            <div>
              <dt>Poručio</dt>
              <dd>{[o.submittedByName, o.contactPhone].filter(Boolean).join(" · ") || "—"}</dd>
            </div>
            {o.biznisoftDocumentNumber ? (
              <div>
                <dt>BizniSoft dokument</dt>
                <dd>{o.biznisoftDocumentNumber}</dd>
              </div>
            ) : null}
          </dl>
          <div className="zp-partner">
            <p className="zp-partner-code">Šifra partnera: {o.partnerCode ?? "—"}</p>
            <div className="zp-partner-box">
              <strong>{o.customerName}</strong>
              {party.city ? <span>{party.city}</span> : null}
              <span>PIB: {party.pib ?? "—"}</span>
            </div>
          </div>
        </section>

        {priced.length ? (
          <table className="zp-table zp-inv" data-sort="off">
            <colgroup>
              <col className="c-rb" />
              <col className="c-sifra" />
              <col />
              <col className="c-jm" />
              <col className="c-kol" />
              <col className="c-osn" />
              <col className="c-rabat" />
              <col className="c-pdv" />
              <col className="c-ipdv" />
              <col className="c-iznos" />
            </colgroup>
            <thead>
              <tr>
                <th>Rb</th>
                <th>Šifra</th>
                <th>Naziv artikla</th>
                <th>JM</th>
                <th className="r">KOL</th>
                <th className="r">Cena bez PDV</th>
                <th className="r">% Rabat</th>
                <th className="r">PDV</th>
                <th className="r">Iznos PDV</th>
                <th className="r">Vrednost sa PDV</th>
              </tr>
            </thead>
            <tbody>
              {priced.map((l, i) => (
                <tr key={l.lineNumber}>
                  <td>{i + 1}.</td>
                  <td className="zp-code">{l.articleCode}</td>
                  <td className="zp-name">
                    {l.articleName}
                    {l.packCount !== null && l.packQuantity !== null && !isSinglePiece({ quantity: l.packQuantity, label: l.packLabel }, l.unit) ? (
                      <span className="zp-sub">poručeno: {l.packCount} × {l.packLabel} = {quantity(l.packCount * l.packQuantity)} {l.unit}</span>
                    ) : l.packQuantity !== null && l.packCount === null ? (
                      <span className="zp-sub">IZUZETAK: {quantity(l.quantity)} {l.unit} nije ceo broj pakovanja ({l.packLabel})</span>
                    ) : l.packConfirmed && l.packQuantity === null ? (
                      <span className="zp-sub">pakovanje {l.packLabel}</span>
                    ) : null}
                  </td>
                  <td>{l.unit}</td>
                  <td className="r">{quantity3(l.quantity)}</td>
                  <td className="r">{amount(l.listPrice)}</td>
                  <td className="r">{amount(l.discountPercent ?? 0)}</td>
                  <td className="r">{l.vatPercent === null ? "—" : `${quantity(l.vatPercent)}%`}</td>
                  <td className="r">{amount(l.lineVat)}</td>
                  <td className="r">{amount(l.lineGross)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}

        {priced.length === 0 ? (
          <section className="zp-unknown">
            <strong>Ukupan iznos: iznos još nije utvrđen.</strong> Sve stavke su na upit ({countOf(onRequest.length, STAVKA)}); cenu potvrđuje kancelarija.
          </section>
        ) : (
          <>
            <p className="zp-sumline">
              {onRequest.length ? "Zbir poznatih cena sa PDV:" : "Ukupan iznos sa PDV:"} <strong>{amount(o.grossTotal)}</strong>
            </p>
            <h2 className="zp-h">Specifikacija poreza</h2>
            <table className="zp-table zp-vat" data-sort="off">
              <thead>
                <tr>
                  <th>Stopa PDV</th>
                  <th className="r">Osnovica</th>
                  <th className="r">Iznos PDV</th>
                  <th className="r">Vrednost sa PDV</th>
                </tr>
              </thead>
              <tbody>
                {vatBreakdown.map((v) => (
                  <tr key={v.rate}>
                    <td>{v.rate === null ? "—" : `${quantity(v.rate)}%`}</td>
                    <td className="r">{amount(v.net)}</td>
                    <td className="r">{amount(v.vat)}</td>
                    <td className="r">{amount(v.gross)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <section className="zp-sums">
              <dl className="zp-sumbox">
                <div>
                  <dt>Vrednost bez PDV:</dt>
                  <dd>{amount(o.netTotal)}</dd>
                </div>
                <div>
                  <dt>Iznos PDV:</dt>
                  <dd>{amount(o.vatTotal)}</dd>
                </div>
                <div>
                  <dt>Vrednost sa PDV:</dt>
                  <dd>{amount(o.grossTotal)}</dd>
                </div>
                <div>
                  <dt>Rabat:</dt>
                  <dd>{amount(discountTotal)}</dd>
                </div>
              </dl>
              <p className="zp-grandline">
                {onRequest.length ? "UKUPNO (BEZ STAVKI NA UPIT):" : "UKUPNO ZA UPLATU:"} {amount(o.grossTotal)}
              </p>
            </section>
            {onRequest.length ? <p className="zp-small">Nije uračunato {countOf(onRequest.length, STAVKA)} na upit (spisak ispod); cenu potvrđuje kancelarija.</p> : null}
          </>
        )}

        <h2 className="zp-h">Način plaćanja</h2>
        <p className="zp-pay">
          <strong>{o.paymentOptionLabel ?? "Po dogovoru sa kancelarijom"}</strong>
          {o.paymentOption === "avans" ? " — cena važi uz uplatu pre isporuke; proveriti uplatu pre isporuke." : ""}
          {o.paymentOption?.startsWith("odlozeno_") ? ` — rok ${o.paymentOption.split("_")[1]} dana od datuma računa.` : ""}
        </p>

        {onRequest.length ? (
          <>
            <h2 className="zp-h">Stavke na upit — cena nije utvrđena{priced.length ? "" : " (sve stavke)"}</h2>
            <table className="zp-table zp-onrequest" data-sort="off">
              <colgroup>
                <col className="c-rb" />
                <col className="c-sifra" />
                <col />
                <col className="c-jm" />
                <col className="c-kol" />
                <col className="c-razlog" />
              </colgroup>
              <thead>
                <tr>
                  <th>Rb</th>
                  <th>Šifra</th>
                  <th>Naziv artikla</th>
                  <th>JM</th>
                  <th className="r">KOL</th>
                  <th>Razlog</th>
                </tr>
              </thead>
              <tbody>
                {onRequest.map((l, i) => (
                  <tr key={l.lineNumber}>
                    <td>{priced.length + i + 1}.</td>
                    <td className="zp-code">{l.articleCode}</td>
                    <td className="zp-name">
                      {l.articleName}
                      {l.packCount !== null && l.packQuantity !== null && !isSinglePiece({ quantity: l.packQuantity, label: l.packLabel }, l.unit) ? (
                        <span className="zp-sub">poručeno: {l.packCount} × {l.packLabel} = {quantity(l.packCount * l.packQuantity)} {l.unit}</span>
                      ) : l.packQuantity !== null && l.packCount === null ? (
                        <span className="zp-sub">IZUZETAK: {quantity(l.quantity)} {l.unit} nije ceo broj pakovanja ({l.packLabel})</span>
                      ) : l.packConfirmed && l.packQuantity === null ? (
                        <span className="zp-sub">pakovanje {l.packLabel}</span>
                      ) : null}
                    </td>
                    <td>{l.unit}</td>
                    <td className="r">{quantity3(l.quantity)}</td>
                    <td>{l.onRequestReason ?? "na upit"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        <h2 className="zp-h">Napomena</h2>
        <div className="zp-notebox">
          {o.customerNote ? (
            <p>
              <strong>Kupac:</strong> {o.customerNote}
            </p>
          ) : null}
          {o.statusReason ? (
            <p>
              <strong>Kancelarija:</strong> {o.statusReason}
            </p>
          ) : null}
          {o.replaces ? (
            <p>
              Verzija {o.revision} zahteva {o.replaces.requestNumber}
              {o.preparedByName ? ` — pripremila kancelarija (${o.preparedByName})` : ""}.
            </p>
          ) : null}
          <p className="zp-small">
            {confirmed ? "Nije faktura ni potvrda isporuke." : "Nije faktura ni rezervacija; raspoloživost i isporuku potvrđuje kancelarija."} Cene su iz cenovnika i odobrenih
            uslova kupca u trenutku slanja.
          </p>
        </div>

        <section className="zp-sign">
          <div>
            <span className="zp-line" />
            <span>(izdao)</span>
          </div>
          <div className="zp-mp">M.P.</div>
          <div>
            <span className="zp-line" />
            <span>(primio)</span>
          </div>
        </section>
        <footer className="zp-foot">
          Odštampao: {user.name}, {dmyTime(new Date())}.
        </footer>
      </article>
    </>
  );
}
