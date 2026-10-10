"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmPasswordAction, setRequestQuantityAction, submitRequestAction } from "./actions";

export type RequestCartView = {
  idempotencyKey: string;
  fingerprint: string;
  canSubmit: boolean;
  blockers: string[];
  options: { code: string | null; key: string; label: string; note: string }[];
  selected: string | null;
  totals: { net: number; vat: number; gross: number };
  onRequest: number;
  correcting: string | null;
  lines: {
    articleId: string; articleCode: string; articleName: string; unit: string; packLabel: string; packConfirmed: boolean;
    quantity: number; step: number; problem: string | null; quantityProblem: string | null;
    prices: { key: string; label: string; status: "cena" | "na_upit"; netPrice: number | null; discountPercent: number | null }[];
    amounts: { net: number; vat: number; gross: number } | null;
  }[];
};

const money = (n: number) => `${n.toLocaleString("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RSD`;

/**
 * Korpa kao zahtev: jedna odobrena opcija plaćanja za ceo zahtev. Uz svaku stavku
 * cena za svaku odobrenu opciju (nije akcija ni precrtana cena). Stavka bez
 * potvrđene cene za izabranu opciju je „na upit“ i nije u zbiru.
 */
export function RequestCartForm({ view }: { view: RequestCartView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [needPassword, setNeedPassword] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; href?: string; blockers?: string[] } | null>(null);
  const selectedLabel = view.options.find((o) => o.code === view.selected)?.label ?? "Plaćanje po dogovoru sa kancelarijom";
  const submit = () =>
    start(async () => {
      const r = await submitRequestAction({ idempotencyKey: view.idempotencyKey, fingerprint: view.fingerprint, paymentOption: view.selected, note, deliveryAddress: address, contactPhone: phone });
      if (r.status === "created" || r.status === "existing") {
        setResult({ ok: true, text: `Zahtev ${r.requestNumber} je primljen. Raspoloživost i isporuku potvrđuje kancelarija; ovo još nije faktura ni rezervacija.`, href: `/kupac/porudzbine/${r.orderId}` });
        router.push(`/kupac/porudzbine/${r.orderId}?poslato=1`);
      } else if (r.status === "reauth") {
        setNeedPassword(true);
        setResult({ ok: false, text: r.message });
      } else if (r.status === "price_changed") {
        setResult({ ok: false, text: r.message });
        router.refresh();
      } else if (r.status === "blocked") {
        setResult({ ok: false, text: r.message, blockers: r.blockers });
      }
    });
  if (result?.ok) {
    return (
      <div className="portal-panel-body">
        <p className="portal-permission-ok" role="status">{result.text}</p>
        <Link href={result.href!} className="portal-button">Pogledajte zahtev</Link>
      </div>
    );
  }
  return (
    <div className="portal-panel-body kr-cart">
      {view.correcting ? <p className="portal-data-note">Ispravka zahteva {view.correcting}.</p> : null}
      {view.options.length > 1 ? (
        <fieldset className="kr-options">
          <legend>Opcija plaćanja za ceo zahtev</legend>
          {view.options.map((o) => (
            // Obična veza (puno učitavanje): server ponovo računa ponudu i otisak za izabranu opciju.
            <a key={o.key} href={`/kupac/korpa?opcija=${encodeURIComponent(o.code ?? "")}`} className="kr-option" aria-current={o.code === view.selected ? "true" : undefined}>
              <strong>{o.label}</strong>
              <small>{o.note}</small>
            </a>
          ))}
          <small>Izbor opcije nije dokaz uplate.</small>
        </fieldset>
      ) : (
        <p className="portal-data-note">Plaćanje: <strong>{selectedLabel}</strong>.</p>
      )}
      <ol className="kr-lines">
        {view.lines.map((l) => (
          <li key={l.articleId} data-on-request={l.prices.find((p) => p.key === (view.selected ?? "osnovni"))?.status === "na_upit" ? "da" : undefined}>
            <div className="kr-name">
              <strong>{l.articleName}</strong>
              <small>Šifra {l.articleCode} · {l.packConfirmed ? `pakovanje ${l.packLabel}` : `JM: ${l.unit} (pakovanje nije potvrđeno)`}</small>
              {l.problem ? <small className="kk-problem">{l.problem}</small> : null}
            </div>
            <ul className="kr-prices">
              {l.prices.map((p) => (
                <li key={p.key} aria-current={p.key === (view.selected ?? "osnovni") ? "true" : undefined}>
                  <span>{p.label}</span>
                  {p.status === "cena" ? <strong>{money(p.netPrice!)} <small>bez PDV-a / {l.unit}</small></strong> : <strong>na upit</strong>}
                </li>
              ))}
            </ul>
            <label className="kr-qty">
              <span>Količina ({l.unit})</span>
              <input defaultValue={String(l.quantity).replace(".", ",")} inputMode="decimal"
                onBlur={(e) => start(async () => { const r = await setRequestQuantityAction({ articleId: l.articleId, quantity: e.target.value.replace(",", ".") }); if (!r.ok) setResult({ ok: false, text: r.message }); router.refresh(); })} />
              {l.quantityProblem ? <small className="kk-problem">{l.quantityProblem}</small> : null}
            </label>
            <div className="kr-amount">
              {l.amounts ? <><strong>{money(l.amounts.net)}</strong><small>bez PDV-a</small></> : <small>na upit — nije u zbiru</small>}
              <button type="button" className="portal-button" data-variant="ghost" disabled={pending}
                onClick={() => start(async () => { await setRequestQuantityAction({ articleId: l.articleId, quantity: "0" }); router.refresh(); })}>Uklonite</button>
            </div>
          </li>
        ))}
      </ol>
      <dl className="ka-facts ka-facts-wide">
        <div><dt>Osnovica (bez PDV-a)</dt><dd>{money(view.totals.net)}</dd></div>
        <div><dt>PDV</dt><dd>{money(view.totals.vat)}</dd></div>
        <div><dt>{view.onRequest ? `Zbir stavki sa poznatom cenom — nije konačan iznos zahteva — ${selectedLabel}` : `Ukupno sa PDV-om — ${selectedLabel}`}</dt><dd>{money(view.totals.gross)}{view.onRequest ? <small>sa PDV-om · bez stavki na upit ({view.onRequest})</small> : null}</dd></div>
      </dl>
      {view.onRequest ? <p className="portal-data-note">Stavke na upit nemaju potvrđenu cenu za izabranu opciju; kancelarija Vam javlja cenu. Zbir ih ne sadrži i nije konačan iznos zahteva.</p> : null}
      <div className="kr-fields">
        <label className="rr-field"><span>Napomena (nije obavezno)</span><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></label>
        <label className="rr-field"><span>Adresa isporuke (ako se razlikuje)</span><input value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} /></label>
        <label className="rr-field"><span>Telefon za kontakt</span><input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" /></label>
      </div>
      {needPassword ? (
        <div className="kr-reauth">
          <label className="rr-field"><span>Lozinka</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
          <button type="button" className="portal-button" data-variant="secondary" disabled={pending || !password}
            onClick={() => start(async () => { const r = await confirmPasswordAction(password); if (r.ok) { setNeedPassword(false); setResult(null); router.refresh(); } else setResult({ ok: false, text: r.message ?? "Lozinka nije ispravna." }); })}>Potvrdite lozinku</button>
        </div>
      ) : null}
      {view.blockers.length ? <ul className="kk-blockers">{view.blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
      <button type="button" className="portal-button" disabled={pending || !view.canSubmit || needPassword} onClick={submit}>
        {pending ? "Šaljem…" : "Pošaljite zahtev za porudžbinu"}
      </button>
      <p className="portal-data-note">Slanjem nastaje zahtev — kancelarija proverava raspoloživost, cene i isporuku. Zahtev nije faktura ni rezervacija.</p>
      {result && !result.ok ? (
        <div className="portal-login-error" role="alert">
          {result.text}
          {result.blockers?.length ? <ul>{result.blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  );
}
