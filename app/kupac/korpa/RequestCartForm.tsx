"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { countOf, STAVKA } from "@/lib/ordering/plural.mjs";
import { amount, money, percent, quantity as fmtQty } from "@/lib/ordering/panelFormat.mjs";
import { ScrollTable } from "@/components/ordering/ScrollTable";
import { confirmPasswordAction, setRequestQuantityAction, submitRequestAction } from "./actions";

export type RequestCartView = {
  idempotencyKey: string;
  fingerprint: string;
  canSubmit: boolean;
  blockers: string[];
  options: { code: string | null; key: string; label: string; note: string }[];
  selected: string | null;
  totals: { net: number; vat: number; gross: number };
  optionTotals: Record<string, { net: number; vat: number; gross: number; onRequest: number }>;
  onRequest: number;
  correcting: string | null;
  lines: {
    articleId: string; articleCode: string; articleName: string; unit: string; packLabel: string; packConfirmed: boolean;
    quantity: number; step: number; problem: string | null; quantityProblem: string | null;
    prices: { key: string; label: string; status: "cena" | "na_upit"; netPrice: number | null; listPrice: number | null; discountPercent: number | null }[];
    amounts: { net: number; vat: number; gross: number } | null;
  }[];
};

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
    if (a.quantity !== b.quantity) out.push(`${b.articleName}: količina ${fmtQty(b.quantity)} → ${fmtQty(a.quantity)} ${a.unit}.`);
    const pb = sel(before, b);
    const pa = sel(after, a);
    const fmt = (p: typeof pb, unit: string) => (p?.status === "cena" && p.netPrice !== null ? `${money(p.netPrice)}/${unit} (rabat ${percent(p.discountPercent ?? 0)})` : "na upit");
    if (fmt(pb, b.unit) !== fmt(pa, a.unit)) out.push(`${b.articleName}: ${fmt(pb, b.unit)} → ${fmt(pa, a.unit)}.`);
  }
  for (const a of after.lines) if (!before.lines.some((x) => x.articleId === a.articleId)) out.push(`${a.articleName}: dodato u korpu.`);
  if (before.totals.gross !== after.totals.gross) out.push(`Zbir sa PDV-om: ${money(before.totals.gross)} → ${money(after.totals.gross)}.`);
  return out;
}

const DRAFT_KEY = "kupac-korpa-nacrt";
type Draft = { note: string; address: string; phone: string };

/**
 * Korpa kao zahtev: jedna odobrena opcija plaćanja za ceo zahtev. Uz opciju njen
 * zbir; uz stavku cena kupca za izabranu opciju (osnovna cena i rabat su prateći
 * podaci). Stavka bez potvrđene cene je „na upit“ i nije u zbiru.
 */
export function RequestCartForm({ view }: { view: RequestCartView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
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
  // Napomena, adresa i telefon preživljavaju promenu opcije plaćanja (puno učitavanje) u istoj kartici.
  useEffect(() => {
    try {
      const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "null") as Draft | null;
      if (d) {
        setNote(d.note ?? "");
        setAddress(d.address ?? "");
        setPhone(d.phone ?? "");
      }
    } catch {
      // bez sessionStorage: polja počinju prazna
    }
  }, []);
  useEffect(() => {
    try {
      if (note || address || phone) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ note, address, phone }));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // nije bitno
    }
  }, [note, address, phone]);

  const selectedKey = view.selected ?? "osnovni";
  const selectedLabel = view.options.find((o) => o.code === view.selected)?.label ?? "Plaćanje po dogovoru sa kancelarijom";
  const allOnRequest = view.onRequest >= view.lines.length;
  const submit = () =>
    start(async () => {
      setBusy("submit");
      let r: Awaited<ReturnType<typeof submitRequestAction>>;
      try {
        r = await submitRequestAction({ idempotencyKey: view.idempotencyKey, fingerprint: view.fingerprint, paymentOption: view.selected, note, deliveryAddress: address, contactPhone: phone });
      } catch {
        // Isti ključ slanja ostaje: ponovni pokušaj ne može da napravi drugi zahtev.
        setBusy(null);
        setResult({ ok: false, text: "Veza sa serverom je prekinuta, pa nije sigurno da je zahtev stigao. Pokušajte ponovo — isti zahtev se neće poslati dvaput. Korpa je sačuvana." });
        return;
      }
      setBusy(null);
      setSeen(null);
      if (r.status === "created" || r.status === "existing") {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          // nije bitno
        }
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
      <div className="pn-note" data-tone="success" role="status">
        <div className="pn-note-row">
          <span>{result.text}</span>
          <Link href={result.href!} className="pn-btn" data-size="sm">
            Pogledajte zahtev
          </Link>
        </div>
      </div>
    );
  }
  const why = needPassword
    ? "Pre slanja potvrdite lozinku (iznad)."
    : !view.canSubmit
      ? view.blockers.length
        ? "Slanje nije moguće dok se ne reše problemi navedeni iznad dugmeta."
        : "Slanje trenutno nije moguće."
      : null;

  return (
    <div className="pn" data-unsaved={note.trim() || address.trim() || phone.trim() ? "true" : undefined}>
      {view.correcting ? (
        <p className="pn-note" data-tone="info">
          <span>
            <strong>Ispravka zahteva {view.correcting}.</strong> Slanjem nastaje nova verzija; raniji zahtev ostaje u istoriji.
          </span>
        </p>
      ) : null}
      {changes.length ? (
        <div className="pn-note" data-tone="warning" role="status">
          <span>
            <strong>Od Vašeg prikaza promenilo se:</strong>
            <ul>
              {changes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            Proverite stavke i zbir, pa ponovo pošaljite zahtev — slanje važi samo za cene koje vidite.
          </span>
        </div>
      ) : null}

      <div className="pn-split">
        <div className="pn" style={{ alignContent: "start" }}>
          {view.options.length > 1 ? (
            <section className="pn-card" aria-labelledby="korpa-opcija">
              <h2 id="korpa-opcija" className="pn-h2">
                Opcija plaćanja za ceo zahtev
              </h2>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))" }}>
                {view.options.map((o) => {
                  const t = view.optionTotals[o.key];
                  const current = o.code === view.selected;
                  const onReq = t?.onRequest ?? 0;
                  return (
                    // Obična veza (puno učitavanje): server ponovo računa ponudu i otisak za izabranu opciju.
                    <a key={o.key} href={`/kupac/korpa?opcija=${encodeURIComponent(o.code ?? "")}`} className="pn-option" aria-current={current ? "true" : undefined}>
                      <span className="pn-option-mark" aria-hidden="true" />
                      <span className="pn-option-body">
                        <span className="pn-option-top">
                          <span className="pn-option-label">{o.label}</span>
                          {current ? <span className="pn-option-state">IZABRANO</span> : <span className="pn-small" style={{ color: "var(--pn-link)" }}>Izaberite</span>}
                        </span>
                        <span className="pn-option-price">
                          {t && onReq < view.lines.length ? (
                            <>
                              <strong className="pn-num">{money(t.gross)}</strong> <span className="pn-small pn-muted">sa PDV-om{onReq ? " · poznate cene" : ""}</span>
                            </>
                          ) : (
                            <strong>Iznos još nije utvrđen</strong>
                          )}
                        </span>
                        {onReq && onReq < view.lines.length ? <span className="pn-option-note">Nije konačno: {countOf(onReq, STAVKA)} na upit.</span> : null}
                        <span className="pn-option-note">{o.note}</span>
                      </span>
                    </a>
                  );
                })}
              </div>
              <p className="pn-small pn-muted">Opcija važi za ceo zahtev. Izbor opcije nije dokaz uplate.</p>
            </section>
          ) : (
            <p className="pn-note">
              <span>
                Plaćanje: <strong>{selectedLabel}</strong>. Izbor opcije nije dokaz uplate.
              </span>
            </p>
          )}

          <section className="pn-card pn-card-flush" aria-labelledby="korpa-stavke">
            <div className="pn-card-h">
              <h2 id="korpa-stavke">
                Stavke <span className="pn-muted pn-num" style={{ fontWeight: 400 }}>· {view.lines.length}</span>
              </h2>
              <span className="pn-small pn-muted">Cene za: {selectedLabel} · bez PDV-a, po jedinici mere</span>
            </div>
            <ScrollTable label="Stavke korpe">
              <table className="pn-table pn-table-cards">
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
                    <th scope="col" className="pn-r">
                      Ukupno <span className="pn-th-sub">sa PDV-om</span>
                    </th>
                    <th scope="col">
                      <span className="pn-sr">Radnja</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.lines.map((l) => {
                    const p = l.prices.find((x) => x.key === selectedKey);
                    const others = l.prices.filter((x) => x.key !== selectedKey);
                    const problem = l.problem || l.quantityProblem;
                    return (
                      <tr key={l.articleId} data-tone={problem ? "warning" : undefined}>
                        <td className="pn-c-code">{l.articleCode}</td>
                        <td className="pn-c-name">
                          <span className="pn-strong">{l.articleName}</span>
                          {l.packConfirmed ? <span className="pn-sub">Pakovanje {l.packLabel}</span> : null}
                          {l.problem ? <span className="pn-error">{l.problem}</span> : null}
                        </td>
                        <td className="pn-r" data-label={`Količina (${l.unit})`}>
                          <span className="pn-inline" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                            <input
                              key={`${l.articleId}-${l.quantity}`}
                              className="pn-input pn-qty"
                              aria-label={`Količina, ${l.articleName} (${l.unit})`}
                              aria-invalid={l.quantityProblem ? true : undefined}
                              defaultValue={String(l.quantity).replace(".", ",")}
                              inputMode="decimal"
                              disabled={busy === `q-${l.articleId}`}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.currentTarget.blur();
                                }
                              }}
                              onBlur={(e) =>
                                e.target.value.trim() !== e.target.defaultValue &&
                                start(async () => {
                                  setBusy(`q-${l.articleId}`);
                                  const r = await setRequestQuantityAction({ articleId: l.articleId, quantity: e.target.value.replace(",", ".") });
                                  setBusy(null);
                                  if (!r.ok) setResult({ ok: false, text: r.message });
                                  ownChange.current = true;
                                  router.refresh();
                                })
                              }
                            />
                            <span className="pn-muted pn-small" style={{ minWidth: 28, textAlign: "left" }}>{l.unit}</span>
                          </span>
                          {l.quantityProblem ? <span className="pn-error" style={{ justifyContent: "flex-end" }}>{l.quantityProblem}</span> : null}
                        </td>
                        <td className="pn-r" data-label="Cena kupca / JM">
                          {p?.status === "cena" ? (
                            <>
                              <span className="pn-num">
                                {amount(p.netPrice)} <span className="pn-muted">/ {l.unit}</span>
                              </span>
                              {p.listPrice !== null ? <span className="pn-sub pn-num">osnovna {amount(p.listPrice)}</span> : null}
                              <span className="pn-sub pn-num">rabat {percent(p.discountPercent ?? 0)}</span>
                            </>
                          ) : (
                            <>
                              <span className="pn-onreq">Na upit</span>
                              <span className="pn-sub">cenu potvrđuje kancelarija</span>
                            </>
                          )}
                          {others.map((o) => (
                            <span key={o.key} className="pn-sub pn-num" style={{ marginTop: 4 }}>
                              {o.label}: {o.status === "cena" ? amount(o.netPrice) : "na upit"}
                            </span>
                          ))}
                        </td>
                        <td className="pn-r pn-num" data-label="Iznos bez PDV-a">
                          {l.amounts ? amount(l.amounts.net) : <span className="pn-muted">—</span>}
                        </td>
                        <td className="pn-r pn-num pn-strong pn-c-total" data-label="Ukupno sa PDV-om">
                          {l.amounts ? amount(l.amounts.gross) : <span className="pn-muted" style={{ fontWeight: 400 }}>nije utvrđen</span>}
                        </td>
                        <td className="pn-c-actions">
                          <button
                            type="button"
                            className="pn-btn"
                            data-variant="quiet"
                            data-size="sm"
                            style={{ color: "var(--pn-danger)" }}
                            aria-label={`Uklonite ${l.articleName} iz korpe`}
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                setBusy(`x-${l.articleId}`);
                                await setRequestQuantityAction({ articleId: l.articleId, quantity: "0" });
                                setBusy(null);
                                ownChange.current = true;
                                router.refresh();
                              })
                            }
                          >
                            {busy === `x-${l.articleId}` ? "Uklanja se…" : "Uklonite"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollTable>
          </section>

          <section className="pn-card pn-form-width" aria-labelledby="korpa-podaci">
            <h2 id="korpa-podaci" className="pn-h2">
              Napomena i isporuka
            </h2>
            <div className="pn-fields">
              <div className="pn-field">
                <label htmlFor="korpa-napomena">
                  Napomena za kancelariju <small>(nije obavezno)</small>
                </label>
                <textarea id="korpa-napomena" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </div>
              <div className="pn-field">
                <label htmlFor="korpa-adresa">
                  Adresa isporuke <small>(samo ako se razlikuje od redovne)</small>
                </label>
                <input id="korpa-adresa" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} autoComplete="street-address" />
              </div>
              <div className="pn-field" style={{ maxWidth: 320 }}>
                <label htmlFor="korpa-telefon">
                  Telefon za kontakt <small>(nije obavezno)</small>
                </label>
                <input id="korpa-telefon" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} inputMode="tel" autoComplete="tel" />
              </div>
            </div>
          </section>
        </div>

        <aside className="pn-side pn-side-sticky" aria-label="Zbir i slanje">
          <section className="pn-card">
            <h2 className="pn-h2">{view.onRequest && !allOnRequest ? "Zbir poznatih cena" : "Zbir"}</h2>
            <p className="pn-small pn-muted">{selectedLabel}</p>
            {allOnRequest ? (
              <>
                <p className="pn-unknown">Iznos još nije utvrđen</p>
                <p className="pn-totals-note">Sve stavke su na upit ({countOf(view.onRequest, STAVKA)}). Kancelarija Vam javlja cenu; nijedna stavka nije besplatna.</p>
              </>
            ) : (
              <>
                <dl className="pn-totals">
                  <dt>Iznos bez PDV-a</dt>
                  <dd>{money(view.totals.net)}</dd>
                  <dt>PDV</dt>
                  <dd>{money(view.totals.vat)}</dd>
                  <dt className="pn-grand">{view.onRequest ? "Zbir sa PDV-om — nije konačan" : "Ukupno sa PDV-om"}</dt>
                  <dd className="pn-grand">{money(view.totals.gross)}</dd>
                </dl>
                {view.onRequest ? <p className="pn-totals-note">Nije konačan iznos zahteva: {countOf(view.onRequest, STAVKA)} na upit nije uračunato. Cenu tih stavki potvrđuje kancelarija.</p> : null}
              </>
            )}
            {needPassword ? (
              <div className="pn-fields" style={{ borderTop: "1px solid var(--p-line)", paddingTop: 12 }}>
                <div className="pn-field">
                  <label htmlFor="korpa-lozinka">Lozinka</label>
                  <input id="korpa-lozinka" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  <span className="pn-help">Radi sigurnosti, pre slanja sa zapamćenog uređaja ponovo unesite lozinku.</span>
                </div>
                <button
                  type="button"
                  className="pn-btn"
                  disabled={pending || !password}
                  aria-busy={busy === "pw" || undefined}
                  onClick={() =>
                    start(async () => {
                      setBusy("pw");
                      const r = await confirmPasswordAction(password);
                      setBusy(null);
                      if (r.ok) {
                        setNeedPassword(false);
                        setResult(null);
                        router.refresh();
                      } else setResult({ ok: false, text: r.message ?? "Lozinka nije ispravna." });
                    })
                  }
                >
                  {busy === "pw" ? "Proverava se…" : "Potvrdite lozinku"}
                </button>
              </div>
            ) : null}
            {view.blockers.length ? (
              <div className="pn-note" data-tone="danger">
                <span>
                  <strong>Pre slanja rešite:</strong>
                  <ul>
                    {view.blockers.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </span>
              </div>
            ) : null}
            <button type="button" className="pn-btn" data-variant="primary" style={{ width: "100%" }} disabled={pending || !view.canSubmit || needPassword} aria-busy={busy === "submit" || undefined} aria-describedby={why ? "korpa-zasto" : "korpa-sta-je"} onClick={submit}>
              {busy === "submit" ? "Šalje se…" : "Pošaljite zahtev za porudžbinu"}
            </button>
            {why ? (
              <p id="korpa-zasto" className="pn-why">
                {why}
              </p>
            ) : null}
            <p id="korpa-sta-je" className="pn-small pn-muted">
              Zahtev nije porudžbina, faktura ni rezervacija. Kancelarija proverava raspoloživost, cene i isporuku i potvrđuje ga.
            </p>
            {result && !result.ok ? (
              <div className="pn-note" data-tone="danger" role="alert">
                <span>
                  {result.text}
                  {result.blockers?.length ? (
                    <ul>
                      {result.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  ) : null}
                </span>
              </div>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
