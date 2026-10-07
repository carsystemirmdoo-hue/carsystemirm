"use client";

import { useActionState, useState } from "react";
import { DateField } from "@/components/portal/DateField";
import { proposeChangeAction, type ProposeChangeState } from "./actions";

type ArticleOption = {
  articleId: string;
  articleCode: string;
  articleName: string | null;
  lastPercent: number | null;
  suggestedPercent: number | null;
};

const INITIAL: ProposeChangeState = { ok: null, error: null };

/**
 * „Predložite promenu" — predlog pravila kupac–artikal.
 *
 * Grupa se ne nudi dok BizniSoft šifarnik grupa ne stigne: grupe iz naziva su
 * samo predlog i pravilo nad njima ne bi pogodilo nijedan artikal.
 */
export function ProposeChangeForm({
  customerId,
  customerName,
  articles,
  initialArticleId,
  today,
}: {
  customerId: string;
  customerName: string;
  articles: ArticleOption[];
  initialArticleId: string | null;
  today: string;
}) {
  const [state, action, pending] = useActionState(proposeChangeAction, INITIAL);
  const [articleId, setArticleId] = useState(initialArticleId ?? articles[0]?.articleId ?? "");
  const selected = articles.find((a) => a.articleId === articleId);
  const [percent, setPercent] = useState<string>(
    selected?.suggestedPercent !== null && selected?.suggestedPercent !== undefined ? String(selected.suggestedPercent) : "",
  );

  return (
    <form action={action} className="rr-propose" id="predlog">
      <input type="hidden" name="customerId" value={customerId} />
      <p className="rr-propose-who">
        Kupac: <strong>{customerName}</strong>
      </p>
      <label className="rr-field">
        <span>Obuhvat</span>
        <select name="scope" defaultValue="article" aria-describedby="rr-scope-hint">
          <option value="article">Kupac – artikal</option>
          <option value="group" disabled>
            Kupac – grupa (čeka BizniSoft šifarnik grupa)
          </option>
        </select>
        <small id="rr-scope-hint">Grupe iz naziva artikla su samo predlog i ne mogu biti osnova pravila.</small>
      </label>
      <label className="rr-field">
        <span>Artikal</span>
        <select
          name="articleId"
          value={articleId}
          onChange={(e) => {
            setArticleId(e.target.value);
            const next = articles.find((a) => a.articleId === e.target.value);
            setPercent(next?.suggestedPercent !== null && next?.suggestedPercent !== undefined ? String(next.suggestedPercent) : "");
          }}
          required
        >
          {articles.map((a) => (
            <option key={a.articleId} value={a.articleId}>
              {a.articleCode} · {a.articleName ?? ""} {a.lastPercent !== null ? `(poslednji ${a.lastPercent} %)` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="rr-field rr-field-short">
        <span>Predloženi rabat (%)</span>
        <input
          name="discountPercent"
          inputMode="decimal"
          value={percent}
          onChange={(e) => setPercent(e.target.value)}
          required
          pattern="[0-9]{1,2}([.,][0-9]{1,2})?|100"
          title="Broj od 0 do 100"
        />
      </label>
      <div className="rr-dates">
        <DateField name="effectiveFrom" label="Važi od" defaultValue={today} required />
        <DateField name="effectiveTo" label="Važi do (nije obavezno)" />
      </div>
      <label className="rr-field rr-field-wide">
        <span>Obrazloženje</span>
        <textarea
          name="reason"
          rows={3}
          minLength={10}
          maxLength={800}
          required
          placeholder="Zašto se predlaže ovaj rabat (dogovor, uslov, promena)…"
        />
        <small>Dokaz iz faktura (poslednje fakture i veza na ovaj pregled) dodaje se automatski.</small>
      </label>
      <div className="rr-propose-actions">
        <button type="submit" disabled={pending || !articleId}>
          {pending ? "Šaljem…" : "Pošaljite predlog na odobrenje"}
        </button>
        <small>Predlog ne menja cenu. Odobrava ga vlasnik u „Odobravanje cena“.</small>
      </div>
      {state.error ? (
        <p className="rb-warn" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="rb-ok" role="status">
          {state.ok}
        </p>
      ) : null}
    </form>
  );
}
