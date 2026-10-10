import Link from "next/link";
import { notFound } from "next/navigation";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { requireCapability } from "@/lib/authz/session";
import { loadOrderRequest } from "@/lib/ordering/ordering-service";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";
import { amount, dmyTime, percent, quantity } from "@/lib/ordering/panelFormat.mjs";
import { companyContact } from "@/lib/company-contact";
import { PrintButton } from "./PrintButton";
import "./stampa.css";

export const dynamic = "force-dynamic";

/**
 * „Zahtev za porudžbinu“ / „Potvrđena porudžbina“ za štampu (A4) — Tamara ga
 * prepisuje u BizniSoft. NIJE faktura.
 *
 * U štampi nema navigacije ni dugmadi. Zaglavlje tabele se ponavlja na svakoj
 * strani; broj dokumenta, verzija i „Strana X od Y“ su u margini svake strane
 * (Chrome/Edge štampa, i PDF iz njih). Stara verzija je označena i na svakoj strani.
 */
export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability("view:zahtevi", `/portal/zahtevi/${encodeURIComponent(id)}/stampa`);
  const o = await loadOrderRequest(user, id);
  if (!o) notFound();
  const priced = o.lines.filter((l) => l.priceStatus === "cena");
  const onRequest = o.lines.filter((l) => l.priceStatus === "na_upit");
  const old = o.current && o.current.id !== o.id ? o.current : null;
  const confirmed = o.status === "confirmed" && o.orderNumber;
  const title = confirmed ? "Potvrđena porudžbina" : "Zahtev za porudžbinu";
  const docNo = confirmed ? `${o.orderNumber} (zahtev ${o.requestNumber})` : o.requestNumber;
  const docShort = `${confirmed ? o.orderNumber : o.requestNumber}${o.revision > 1 ? ` · verzija ${o.revision}` : ""}`;
  // Ista stopa PDV-a na svim stavkama → bez kolone; stopa se navodi uz zbir.
  const vatRates = [...new Set(priced.map((l) => l.vatPercent))];
  const vatColumn = vatRates.length > 1;
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
      <style>{pageCss}</style>
      <article className="zp-doc" aria-label={title} data-old={old ? "true" : undefined}>
        {old ? (
          <p className="zp-old">
            STARA VERZIJA — zamenjena verzijom {old.orderNumber ?? old.requestNumber}. Ne koristiti za unos u BizniSoft.
          </p>
        ) : null}
        <header className="zp-head">
          <div>
            <p className="zp-firm">{companyContact.legalName}</p>
            <h1>{title}</h1>
            <p className="zp-not">{confirmed ? "Nije faktura ni potvrda isporuke." : "Nije faktura ni rezervacija. Raspoloživost i isporuku potvrđuje kancelarija."}</p>
          </div>
          <dl>
            <div>
              <dt>Broj</dt>
              <dd>{docNo}</dd>
            </div>
            <div>
              <dt>Verzija</dt>
              <dd>
                {o.revision}
                {old ? " (stara)" : o.versions.length > 1 ? " (važeća)" : ""}
              </dd>
            </div>
            <div>
              <dt>Poslato</dt>
              <dd>{dmyTime(o.submittedAt)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] ?? o.status}</dd>
            </div>
            {o.biznisoftDocumentNumber ? (
              <div>
                <dt>BizniSoft</dt>
                <dd>{o.biznisoftDocumentNumber}</dd>
              </div>
            ) : null}
          </dl>
        </header>

        <section className="zp-parties">
          <div>
            <h2>Kupac</h2>
            <p>
              <strong>{o.customerName}</strong>
            </p>
            <p>Šifra partnera: {o.partnerCode ?? "—"}</p>
            <p>Kontakt: {[o.submittedByName, o.contactPhone, o.contactEmail].filter(Boolean).join(" · ") || "—"}</p>
            <p>Adresa isporuke: {o.deliveryAddress ?? "redovna adresa kupca"}</p>
          </div>
          <div>
            <h2>Plaćanje</h2>
            <p>
              <strong>{o.paymentOptionLabel ?? "Po dogovoru sa kancelarijom"}</strong>
            </p>
            {o.paymentOption === "avans" ? <p>Cena važi uz uplatu pre isporuke — proveriti uplatu pre potvrde isporuke.</p> : null}
            {o.paymentOption?.startsWith("odlozeno_") ? <p>Rok: {o.paymentOption.split("_")[1]} dana od datuma računa.</p> : null}
            <p>Izbor opcije nije dokaz uplate.</p>
          </div>
        </section>

        {priced.length ? (
          <table className="zp-table">
            <colgroup>
              <col className="c-rb" />
              <col className="c-sifra" />
              <col />
              <col className="c-jm" />
              <col className="c-kol" />
              <col className="c-osn" />
              <col className="c-rabat" />
              <col className="c-cena" />
              <col className="c-iznos" />
              {vatColumn ? <col className="c-pdv" /> : null}
            </colgroup>
            <thead>
              <tr>
                <th>Rb</th>
                <th>Šifra</th>
                <th>Naziv artikla</th>
                <th>JM</th>
                <th className="r">Količina</th>
                <th className="r">Osnovna cena</th>
                <th className="r">Rabat</th>
                <th className="r">Cena kupca / JM bez PDV-a</th>
                <th className="r">Iznos bez PDV-a</th>
                {vatColumn ? <th className="r">PDV</th> : null}
              </tr>
            </thead>
            <tbody>
              {priced.map((l) => (
                <tr key={l.lineNumber}>
                  <td className="r">{l.lineNumber}.</td>
                  <td className="nw">{l.articleCode}</td>
                  <td className="zp-name">
                    {l.articleName}
                    {l.packConfirmed ? <span className="zp-sub">pakovanje {l.packLabel}</span> : null}
                  </td>
                  <td>{l.unit}</td>
                  <td className="r">{quantity(l.quantity)}</td>
                  <td className="r">{amount(l.listPrice)}</td>
                  <td className="r">{percent(l.discountPercent ?? 0)}</td>
                  <td className="r b">{amount(l.netPrice)}</td>
                  <td className="r">{amount(l.lineNet)}</td>
                  {vatColumn ? <td className="r">{percent(l.vatPercent)}</td> : null}
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
          <section className="zp-totals">
            <dl>
              <div>
                <dt>{onRequest.length ? "Zbir poznatih cena bez PDV-a" : "Iznos bez PDV-a"}</dt>
                <dd>{amount(o.netTotal)} RSD</dd>
              </div>
              <div>
                <dt>PDV{!vatColumn && vatRates[0] !== null && vatRates[0] !== undefined ? ` ${percent(vatRates[0])}` : ""}</dt>
                <dd>{amount(o.vatTotal)} RSD</dd>
              </div>
              <div className="zp-grand">
                <dt>{onRequest.length ? "Zbir poznatih cena sa PDV-om — nije konačan iznos" : "Ukupno sa PDV-om"}</dt>
                <dd>{amount(o.grossTotal)} RSD</dd>
              </div>
            </dl>
            {onRequest.length ? <p>Nije uračunato {countOf(onRequest.length, STAVKA)} na upit (spisak ispod); cenu potvrđuje kancelarija.</p> : null}
          </section>
        )}

        {onRequest.length ? (
          <>
            <h2 className="zp-h">Stavke na upit — cena nije utvrđena{priced.length ? "" : " (sve stavke)"}</h2>
            <table className="zp-table zp-onrequest">
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
                  <th className="r">Količina</th>
                  <th>Razlog</th>
                </tr>
              </thead>
              <tbody>
                {onRequest.map((l) => (
                  <tr key={l.lineNumber}>
                    <td className="r">{l.lineNumber}.</td>
                    <td className="nw">{l.articleCode}</td>
                    <td className="zp-name">
                      {l.articleName}
                      {l.packConfirmed ? <span className="zp-sub">pakovanje {l.packLabel}</span> : null}
                    </td>
                    <td>{l.unit}</td>
                    <td className="r">{quantity(l.quantity)}</td>
                    <td>{l.onRequestReason ?? "na upit"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        <section className="zp-notes">
          {o.customerNote ? (
            <p>
              <strong>Napomena kupca:</strong> {o.customerNote}
            </p>
          ) : null}
          {o.statusReason ? (
            <p>
              <strong>Napomena kancelarije:</strong> {o.statusReason}
            </p>
          ) : null}
          {o.replaces ? (
            <p>
              Verzija {o.revision} zahteva {o.replaces.requestNumber}
              {o.preparedByName ? ` — pripremila kancelarija (${o.preparedByName})` : ""}.
            </p>
          ) : null}
        </section>
        <footer className="zp-foot">
          Cene su iz cenovnika i odobrenih uslova kupca u trenutku slanja, po jedinici mere. Cena kupca = osnovna cena umanjena za rabat. Odštampao: {user.name},{" "}
          {dmyTime(new Date())}.
        </footer>
      </article>
    </>
  );
}
