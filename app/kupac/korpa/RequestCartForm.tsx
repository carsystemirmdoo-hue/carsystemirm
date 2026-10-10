"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
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

/** Šta se promenilo između prikaza koji je kupac video i nove ponude servera (za novu potvrdu). */
export function describeChanges(before: RequestCartView, after: RequestCartView): string[] {
  const out: string[] = [];
  const label = (v: RequestCartView) => v.options.find((o) => o.code === v.selected)?.label ?? "po dogovoru";
  if (before.selected !== after.selected) {
    const still = after.options.some((o) => o.code === before.selected);
    out.push(still ? `Opcija plaćanja: ${label(before)} → ${label(after)}.` : `Opcija „${label(before)}“ više nije odobrena; sada je izabrano: ${label(after)}.`);
  }
  for (const o of before.options) if (!after.options.some((x) => x.key === o.key) && o.code !== before.selected) out.push(`Opcija „${o.label}“ više nije ponuđena.`);
  for (const o of after.options) if (!before.options.some((x) => x.key === o.key)) out.push(`Nova odobrena opcija: ${o.label}.`);
  const sel = (v: RequestCartView, l: RequestCartView["lines"][number]) => l.prices.find((p) => p.key === (v.selected ?? "osnovni"));
  for (const b of before.lines) {
    const a = after.lines.find((x) => x.articleId === b.articleId);
    if (!a) {
      out.push(`${b.articleName}: uklonjeno iz korpe.`);
      continue;
    }
    if (a.quantity !== b.quantity) out.push(`${b.articleName}: količina ${b.quantity} → ${a.quantity} ${a.unit}.`);
    const pb = sel(before, b);
    const pa = sel(after, a);
    const fmt = (p: typeof pb, unit: string) => (p?.status === "cena" && p.netPrice !== null ? `${money(p.netPrice)}/${unit} (rabat ${p.discountPercent} %)` : "na upit");
    if (fmt(pb, b.unit) !== fmt(pa, a.unit)) out.push(`${b.articleName}: ${fmt(pb, b.unit)} → ${fmt(pa, a.unit)}.`);
  }
  for (const a of after.lines) if (!before.lines.some((x) => x.articleId === a.articleId)) out.push(`${a.articleName}: dodato u korpu.`);
  if (before.totals.gross !== after.totals.gross) out.push(`Zbir sa PDV-om: ${money(before.totals.gross)} → ${money(after.totals.gross)}.`);
  return out;
}

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
  // Prikaz koji je kupac video pre nego što je server javio promenu — razlika se prikazuje uz novu potvrdu.
  const [seen, setSeen] = useState<RequestCartView | null>(null);
  const changes = useMemo(() => (seen && seen.fingerprint !== view.fingerprint ? describeChanges(seen, view) : []), [seen, view]);
  // Automatsko osvežavanje (drugi prozor, nova cena ili opcija): prikaz se ne menja neprimetno — razlika ostaje vidljiva.
  const previous = useRef(view);
  const ownChange = useRef(false);
  useEffect(() => {
    // Sopstvena izmena (količina, uklanjanje) nije „promena od prikaza“.
    if (ownChange.current) ownChange.current = false;
    else if (previous.current.fingerprint !== view.fingerprint && !seen) setSeen(previous.current);
    previous.current = view;
  }, [view, seen]);
  const selectedLabel = view.options.find((o) => o.code === view.selected)?.label ?? "Plaćanje po dogovoru sa kancelarijom";
  const submit = () =>
    start(async () => {
      let r: Awaited<ReturnType<typeof submitRequestAction>>;
      try {
        r = await submitRequestAction({ idempotencyKey: view.idempotencyKey, fingerprint: view.fingerprint, paymentOption: view.selected, note, deliveryAddress: address, contactPhone: phone });
      } catch {
        // Isti ključ slanja ostaje: ponovni pokušaj ne može da napravi drugi zahtev.
        setResult({ ok: false, text: "Veza sa serverom je prekinuta, pa nije sigurno da je zahtev stigao. Pokušajte ponovo — isti zahtev se neće poslati dvaput. Korpa je sačuvana." });
        return;
      }
      setSeen(null);
      if (r.status === "created" || r.status === "existing") {
        setResult({ ok: true, text: `Zahtev ${r.requestNumber} je primljen. Raspoloživost i isporuku potvrđuje kancelarija; ovo još nije faktura ni rezervacija.`, href: `/kupac/porudzbine/${r.orderId}` });
        router.push(`/kupac/porudzbine/${r.orderId}?poslato=1`);
      } else if (r.status === "reauth") {
        setNeedPassword(true);
        setResult({ ok: false, text: r.message });
      } else if (r.status === "price_changed") {
        setSeen(view);
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
    <div className="portal-panel-body kr-cart" data-unsaved={note.trim() || address.trim() || phone.trim() ? "true" : undefined}>
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
              <small>Šifra {l.articleCode} · {l.packConfirmed ? `pakovanje ${l.packLabel}` : `JM: ${l.unit}`}</small>
              {l.problem ? <small className="kk-problem">{l.problem}</small> : null}
            </div>
            <ul className="kr-prices" aria-label="Cena po jedinici bez PDV-a">
              <li className="kr-prices-head">Cena po jedinici bez PDV-a</li>
              {l.prices.map((p) => (
                <li key={p.key} aria-current={p.key === (view.selected ?? "osnovni") ? "true" : undefined}>
                  <span>{p.label}</span>
                  {p.status === "cena" ? <strong>{money(p.netPrice!)} <small>/ {l.unit}</small></strong> : <strong>na upit</strong>}
                </li>
              ))}
            </ul>
            <label className="kr-qty">
              <span>Količina ({l.unit})</span>
              <input key={`${l.articleId}-${l.quantity}`} defaultValue={String(l.quantity).replace(".", ",")} inputMode="decimal"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                onBlur={(e) => e.target.value.trim() !== e.target.defaultValue && start(async () => { const r = await setRequestQuantityAction({ articleId: l.articleId, quantity: e.target.value.replace(",", ".") }); if (!r.ok) setResult({ ok: false, text: r.message }); ownChange.current = true; router.refresh(); })} />
              {l.quantityProblem ? <small className="kk-problem">{l.quantityProblem}</small> : null}
            </label>
            <div className="kr-amount">
              <small className="kr-amount-head">Ukupno za količinu sa PDV-om</small>
              {l.amounts ? <><strong>{money(l.amounts.gross)}</strong><small>bez PDV-a {money(l.amounts.net)}</small></> : <><strong>Iznos još nije utvrđen</strong><small>na upit — nije u zbiru</small></>}
              <button type="button" className="portal-button" data-variant="ghost" disabled={pending}
                onClick={() => start(async () => { await setRequestQuantityAction({ articleId: l.articleId, quantity: "0" }); ownChange.current = true; router.refresh(); })}>Uklonite</button>
            </div>
          </li>
        ))}
      </ol>
      {view.onRequest >= view.lines.length ? (
        <dl className="ka-facts ka-facts-wide">
          <div><dt>Ukupan iznos — {selectedLabel}</dt><dd>Iznos još nije utvrđen<small>sve stavke su na upit ({countOf(view.onRequest, STAVKA)}); cenu potvrđuje kancelarija</small></dd></div>
        </dl>
      ) : (
        <dl className="ka-facts ka-facts-wide">
          <div><dt>Osnovica (bez PDV-a)</dt><dd>{money(view.totals.net)}</dd></div>
          <div><dt>PDV</dt><dd>{money(view.totals.vat)}</dd></div>
          <div><dt>{view.onRequest ? `Zbir stavki sa poznatom cenom — nije konačan iznos zahteva — ${selectedLabel}` : `Ukupno sa PDV-om — ${selectedLabel}`}</dt><dd>{money(view.totals.gross)}{view.onRequest ? <small>sa PDV-om · nije uračunato na upit: {countOf(view.onRequest, STAVKA)}</small> : null}</dd></div>
        </dl>
      )}
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
      {changes.length ? (
        <div className="kr-changes" role="status">
          <strong>Šta se promenilo od prikaza:</strong>
          <ul>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      ) : null}
      {result && !result.ok ? (
        <div className="portal-login-error" role="alert">
          {result.text}
          {result.blockers?.length ? <ul>{result.blockers.map((b) => <li key={b}>{b}</li>)}</ul> : null}
        </div>
      ) : null}
    </div>
  );
}
