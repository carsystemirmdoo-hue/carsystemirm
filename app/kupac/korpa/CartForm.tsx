"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmPasswordAction, removeFromCartAction, setCartQuantityAction, submitCartAction } from "./actions";

export type CartView = {
  correcting: { orderId: string; requestNumber: string; reason: string | null } | null;
  idempotencyKey: string;
  fingerprint: string;
  canSubmit: boolean;
  blockers: string[];
  currency: string;
  totals: { net: number; vat: number; gross: number };
  lines: {
    articleId: string;
    articleCode: string;
    articleName: string;
    name: string;
    href: string | null;
    image: { src: string; alt: string } | null;
    variantLabel: string | null;
    quantity: number;
    unit: string | null;
    packLabel: string | null;
    listPrice: number | null;
    discountPercent: number;
    netPrice: number | null;
    vatPercent: number | null;
    amounts: { net: number; vat: number; gross: number } | null;
    problem: string | null;
    quantityProblem: string | null;
    step: number;
  }[];
};

const fmt = new Intl.NumberFormat("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qfmt = new Intl.NumberFormat("sr-Latn-RS", { maximumFractionDigits: 3 });

export function CartForm({ view }: { view: CartView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ tone: "error" | "warning"; text: string; items?: string[] } | null>(null);
  const [note, setNote] = useState("");
  const [reauth, setReauth] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const money = (n: number | null) => (n === null ? "—" : `${fmt.format(n)} ${view.currency}`);

  const update = (articleId: string, quantity: string) =>
    start(async () => {
      const r = await setCartQuantityAction({ articleId, quantity });
      setMessage(r.ok ? null : { tone: "error", text: r.message });
      router.refresh();
    });

  const remove = (articleId: string) =>
    start(async () => {
      await removeFromCartAction(articleId);
      setMessage(null);
      router.refresh();
    });

  const confirmAndSubmit = () =>
    start(async () => {
      const ok = await confirmPasswordAction(password);
      if (!ok.ok) {
        setMessage({ tone: "error", text: ok.message ?? "Lozinka nije ispravna." });
        return;
      }
      setReauth(null);
      setPassword("");
      const r = await submitCartAction({ idempotencyKey: view.idempotencyKey, fingerprint: view.fingerprint, note });
      if (r.status === "created" || r.status === "existing") {
        router.push(`/kupac/porudzbine/${r.orderId}?poslato=1`);
        return;
      }
      if (r.status === "price_changed") setMessage({ tone: "warning", text: r.message });
      else if (r.status === "blocked") setMessage({ tone: "error", text: r.message, items: r.blockers });
      else if (r.status === "reauth") setMessage({ tone: "error", text: r.message });
      router.refresh();
    });

  const submit = () =>
    start(async () => {
      const r = await submitCartAction({ idempotencyKey: view.idempotencyKey, fingerprint: view.fingerprint, note });
      if (r.status === "created" || r.status === "existing") {
        router.push(`/kupac/porudzbine/${r.orderId}?poslato=1`);
        return;
      }
      if (r.status === "reauth") {
        setReauth(r.message);
        setMessage(null);
        return;
      }
      if (r.status === "price_changed") {
        setMessage({ tone: "warning", text: r.message });
      } else if (r.status === "blocked") {
        setMessage({ tone: "error", text: r.message, items: r.blockers });
      }
      router.refresh();
    });

  return (
    <div className="portal-panel-body kk-body">
      {view.correcting ? (
        <div className="kk-correcting" role="note">
          <strong>Ispravljate zahtev {view.correcting.requestNumber}.</strong>{" "}
          {view.correcting.reason ? <>Kancelarija je tražila: „{view.correcting.reason}”. </> : null}
          Posle slanja nastaje nov zahtev povezan sa prethodnim; prethodni ostaje u istoriji.{" "}
          <Link href={`/kupac/porudzbine/${view.correcting.orderId}`}>Prethodni zahtev →</Link>
        </div>
      ) : null}
      <ol className="kk-lines">
        <li className="kk-lines-head" aria-hidden="true">
          <span>Artikal</span>
          <span>Pakovanje</span>
          <span>Količina</span>
          <span>Cena bez PDV-a</span>
          <span>PDV</span>
          <span>Ukupno</span>
        </li>
        {view.lines.map((l) => (
          <li key={l.articleId} data-problem={l.problem || l.quantityProblem ? "true" : undefined}>
            <span className="kk-name">
              {l.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.image.src} alt="" loading="lazy" />
              ) : (
                <span className="kk-noimg" aria-hidden="true" />
              )}
              <span>
                {l.href ? <Link href={l.href}>{l.name}</Link> : <strong>{l.name}</strong>}
                {l.variantLabel ? <small>Varijanta: {l.variantLabel}</small> : null}
                <small>
                  Šifra {l.articleCode}
                  {l.name !== l.articleName ? ` · ${l.articleName}` : ""}
                </small>
                {l.problem ? <em className="kk-problem">{l.problem} Uklonite stavku da biste poslali zahtev.</em> : null}
                {l.quantityProblem ? <em className="kk-problem">{l.quantityProblem}</em> : null}
              </span>
            </span>
            <span data-label="Pakovanje">
              {l.packLabel ?? "—"}
              {l.unit ? <small>JM: {l.unit}</small> : null}
            </span>
            <span data-label="Količina" className="kk-qty">
              <input
                type="number"
                inputMode="decimal"
                min={l.step}
                step={l.step}
                defaultValue={l.quantity}
                aria-label={`Količina, ${l.name}`}
                disabled={pending}
                onBlur={(e) => Number(e.currentTarget.value) !== l.quantity && update(l.articleId, e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                  }
                }}
              />
              <button type="button" className="kk-remove" onClick={() => remove(l.articleId)} disabled={pending}>
                Ukloni
              </button>
            </span>
            <span data-label="Cena bez PDV-a">
              {money(l.netPrice)}
              {l.unit ? <small>po {l.unit}</small> : null}
              {l.discountPercent ? (
                <small>
                  cenovnik {money(l.listPrice)} − {qfmt.format(l.discountPercent)} %
                </small>
              ) : null}
            </span>
            <span data-label="PDV">
              {l.amounts ? money(l.amounts.vat) : "—"}
              {l.vatPercent !== null ? <small>{qfmt.format(l.vatPercent)} %</small> : null}
            </span>
            <span data-label="Ukupno" className="ka-amount">
              {l.amounts ? money(l.amounts.gross) : "—"}
              {l.amounts ? <small>bez PDV-a {money(l.amounts.net)}</small> : null}
            </span>
          </li>
        ))}
      </ol>

      <div className="kk-foot">
        <label className="kk-note">
          <span>Napomena za kancelariju (nije obavezno)</span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} disabled={pending} />
        </label>
        <div className="kk-summary">
          <dl>
            <div>
              <dt>Osnovica (bez PDV-a)</dt>
              <dd>{money(view.totals.net)}</dd>
            </div>
            <div>
              <dt>PDV</dt>
              <dd>{money(view.totals.vat)}</dd>
            </div>
            <div className="kk-total">
              <dt>Ukupno sa PDV-om</dt>
              <dd>{money(view.totals.gross)}</dd>
            </div>
          </dl>
          {message ? (
            <div className="kk-message" data-tone={message.tone} role="alert">
              <p>{message.text}</p>
              {message.items?.length ? (
                <ul>
                  {message.items.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {!view.canSubmit && view.blockers.length ? (
            <ul className="kk-blockers">
              {view.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          {reauth ? (
            <div className="kk-reauth" role="group" aria-label="Potvrda lozinkom">
              <p>{reauth} Prijavljeni ste sa zapamćenog uređaja.</p>
              <input
                type="password"
                autoComplete="current-password"
                aria-label="Lozinka"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={pending}
              />
              <button type="button" className="portal-button kk-submit" data-variant="primary" onClick={confirmAndSubmit} disabled={pending || !password}>
                {pending ? "Proveravam…" : "Potvrdi lozinkom i pošalji"}
              </button>
            </div>
          ) : null}
          <button
            hidden={Boolean(reauth)}
            type="button"
            className="portal-button kk-submit"
            data-variant="primary"
            onClick={submit}
            disabled={pending || !view.canSubmit}
            aria-busy={pending}
          >
            {pending ? "Šaljem…" : "Pošalji zahtev kancelariji"}
          </button>
          <small className="kk-fine">
            Zahtev nije porudžbina: kancelarija proverava artikle, količine i cene i potvrđuje ga. Status pratite u
            „Porudžbine”.
          </small>
        </div>
      </div>
    </div>
  );
}
