import Link from "next/link";
import { notFound } from "next/navigation";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { requireCapability } from "@/lib/authz/session";
import { loadOrderRequest } from "@/lib/ordering/ordering-service";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { ORDER_STATUS_LABELS } from "@/lib/ordering/orderRules.mjs";
import { PrintButton } from "./PrintButton";

export const dynamic = "force-dynamic";

const money = (n: number | null) => (n === null ? "—" : n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const qty = (n: number) => n.toLocaleString("sr-RS", { maximumFractionDigits: 3 });
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("sr-RS", { maximumFractionDigits: 3 })} %`);
const dt = (d: Date) => new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);

/**
 * „Zahtev za porudžbinu“ za štampu (A4) — Tamara ga prepisuje u BizniSoft.
 * NIJE faktura. U štampi nema navigacije ni dugmadi; zaglavlje tabele se
 * ponavlja na svakoj strani; nazivi se prelamaju (bez odsečenih kolona).
 */
export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability("view:zahtevi", `/portal/zahtevi/${encodeURIComponent(id)}/stampa`);
  const o = await loadOrderRequest(user, id);
  if (!o) notFound();
  const priced = o.lines.filter((l) => l.priceStatus === "cena");
  const onRequest = o.lines.filter((l) => l.priceStatus === "na_upit");
  return (
    <>
      <CrumbLabel segment={o.id} label={o.orderNumber ?? o.requestNumber} />
      <CrumbLabel segment="stampa" label="Štampa" />
      <p className="zp-screen-only kk-back">
        <Link href={`/portal/zahtevi/${o.id}`}>← Nazad na zahtev</Link> <PrintButton />{" "}
        <small>Za PDF u dijalogu štampe izaberite čuvanje kao PDF.</small>
      </p>
      {o.current && o.current.id !== o.id ? (
        <div className="kk-old-version zp-screen-only" role="note">
          <strong>Stara verzija — važeća je {o.current.orderNumber ?? o.current.requestNumber}.</strong>
          <Link href={`/portal/zahtevi/${o.current.id}/stampa`} className="portal-button">Otvorite važeću verziju</Link>
        </div>
      ) : null}
      {/* Broj zahteva i strana na svakom listu (margine strane A4), da se odvojen list može prepoznati. */}
      <style>{`@page { @bottom-left { content: ${JSON.stringify(`Zahtev za porudžbinu ${o.requestNumber}`)}; font-size: 7.5pt; color: #555; } @bottom-right { content: "Strana " counter(page) " od " counter(pages); font-size: 7.5pt; color: #555; } }`}</style>
      <article className="zp-doc" aria-label="Zahtev za porudžbinu">
        <header className="zp-head">
          <div>
            <h1>Zahtev za porudžbinu</h1>
            <p className="zp-not">Nije faktura · nije rezervacija · raspoloživost i isporuku potvrđuje kancelarija</p>
          </div>
          <dl>
            <div><dt>Broj</dt><dd>{o.requestNumber}{o.revision > 1 ? ` (verzija ${o.revision})` : ""}</dd></div>
            <div><dt>Datum</dt><dd>{dt(o.submittedAt)}</dd></div>
            <div><dt>Status</dt><dd>{ORDER_STATUS_LABELS[o.status as keyof typeof ORDER_STATUS_LABELS] ?? o.status}</dd></div>
            {o.current && o.current.id !== o.id ? <div><dt>Važeća</dt><dd>{o.current.orderNumber ?? o.current.requestNumber} (ovo je stara verzija)</dd></div> : null}
            {o.orderNumber ? <div><dt>Porudžbina</dt><dd>{o.orderNumber}</dd></div> : null}
          </dl>
        </header>

        <section className="zp-parties">
          <div>
            <h2>Kupac</h2>
            <p><strong>{o.customerName}</strong></p>
            <p>Šifra partnera: {o.partnerCode ?? "—"}</p>
            <p>Kontakt: {[o.submittedByName, o.contactPhone, o.contactEmail].filter(Boolean).join(" · ") || "—"}</p>
            <p>Adresa isporuke: {o.deliveryAddress ?? "nije navedena (redovna adresa kupca)"}</p>
          </div>
          <div>
            <h2>Plaćanje</h2>
            <p><strong>{o.paymentOptionLabel ?? "Po dogovoru sa kancelarijom"}</strong></p>
            {o.paymentOption === "avans" ? <p>Cena važi uz uplatu pre isporuke — proveriti uplatu pre potvrde isporuke.</p> : null}
            {o.paymentOption?.startsWith("odlozeno_") ? <p>Rok: {o.paymentOption.split("_")[1]} dana od datuma računa.</p> : null}
            <p>Izbor opcije nije dokaz uplate.</p>
          </div>
        </section>

        {priced.length ? (
        <table className="zp-table">
          <colgroup>
            <col className="c-rb" /><col className="c-sifra" /><col className="c-naziv" /><col className="c-jm" /><col className="c-kol" />
            <col className="c-cena" /><col className="c-rabat" /><col className="c-cena" /><col className="c-iznos" /><col className="c-pdv" />
          </colgroup>
          <thead>
            <tr>
              <th>Rb</th><th>Šifra</th><th>Naziv artikla</th><th>JM / pakovanje</th><th className="r">Količina</th>
              <th className="r">Osnovna cena po JM</th><th className="r">Rabat</th><th className="r">Cena po jedinici bez PDV-a</th><th className="r">Ukupno za količinu bez PDV-a</th><th className="r">PDV</th>
            </tr>
          </thead>
          <tbody>
            {priced.map((l) => (
              <tr key={l.lineNumber}>
                <td>{l.lineNumber}.</td>
                <td>{l.articleCode}</td>
                <td className="zp-name">{l.articleName}</td>
                <td>{l.unit}{l.packConfirmed ? ` · ${l.packLabel}` : ""}</td>
                <td className="r">{qty(l.quantity)}</td>
                <td className="r">{money(l.listPrice)}</td>
                <td className="r">{pct(l.discountPercent)}</td>
                <td className="r">{money(l.netPrice)}</td>
                <td className="r">{money(l.lineNet)}</td>
                <td className="r">{pct(l.vatPercent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        ) : null}

        {priced.length === 0 ? (
          <section className="zp-totals">
            <dl>
              <div className="zp-grand"><dt>Ukupan iznos</dt><dd>Iznos još nije utvrđen</dd></div>
            </dl>
            <p>Sve stavke su na upit; cenu potvrđuje kancelarija.</p>
          </section>
        ) : (
        <section className="zp-totals">
          <dl>
            <div><dt>Osnovica bez PDV-a</dt><dd>{money(o.netTotal)} RSD</dd></div>
            <div><dt>PDV</dt><dd>{money(o.vatTotal)} RSD</dd></div>
            <div className="zp-grand"><dt>{onRequest.length ? "Zbir stavki sa poznatom cenom — nije konačan iznos zahteva (sa PDV-om)" : "Ukupno sa PDV-om"}</dt><dd>{money(o.grossTotal)} RSD</dd></div>
          </dl>
          {onRequest.length ? <p>Nije uračunato na upit: {countOf(onRequest.length, STAVKA)}; cenu potvrđuje kancelarija.</p> : null}
        </section>
        )}

        {onRequest.length ? (
          <>
            <h2 className="zp-h">Stavke na upit — cena nije potvrđena za izabranu opciju</h2>
            <table className="zp-table zp-onrequest">
              <colgroup><col className="c-rb" /><col className="c-sifra" /><col className="c-naziv" /><col className="c-jm" /><col className="c-kol" /><col className="c-razlog" /></colgroup>
              <thead><tr><th>Rb</th><th>Šifra</th><th>Naziv artikla</th><th>JM / pakovanje</th><th className="r">Količina</th><th>Napomena</th></tr></thead>
              <tbody>
                {onRequest.map((l) => (
                  <tr key={l.lineNumber}>
                    <td>{l.lineNumber}.</td><td>{l.articleCode}</td><td className="zp-name">{l.articleName}</td>
                    <td>{l.unit}{l.packConfirmed ? ` · ${l.packLabel}` : ""}</td><td className="r">{qty(l.quantity)}</td><td>{l.onRequestReason ?? "na upit"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}

        <section className="zp-notes">
          {o.customerNote ? <p><strong>Napomena kupca:</strong> {o.customerNote}</p> : null}
          {o.statusReason ? <p><strong>Napomena kancelarije:</strong> {o.statusReason}</p> : null}
          {o.replaces ? <p>Verzija {o.revision} zahteva {o.replaces.requestNumber}{o.preparedByName ? ` — pripremila kancelarija (${o.preparedByName})` : ""}.</p> : null}
        </section>
        <footer className="zp-foot">
          Cene su bez PDV-a, iz cenovnika i odobrenih uslova kupca u trenutku slanja. Odštampao: {user.name}, {dt(new Date())}.
        </footer>
      </article>
    </>
  );
}
