"use client";

import { useMemo, useState, useTransition } from "react";
import { DateField } from "@/components/portal/DateField";
import type { ChangeAction } from "@/lib/pricing/rebate-change-service";
import { previewChangeAction, submitChangeAction } from "./change-actions";

type ArticleOption = { articleId: string; articleCode: string; articleName: string | null; lastPercent: number | null; currentPercent: string | null };
type Family = {
  key: string;
  percent: number;
  evidence: { articles: number; days: number; share: number; window: [string, string]; actions: number };
  members: { articleId: string; code: string; name: string }[];
};
type Preview = Extract<Awaited<ReturnType<typeof previewChangeAction>>, { ok: true }>["preview"];

const ACTION: Record<ChangeAction, string> = {
  novo: "novo pravilo",
  zamena: "zamena važećeg",
  bez_promene: "bez promene",
  izuzetak: "izuzetak",
  ceka_odluku: "već čeka odluku",
  van_programa: "van programa",
};
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${String(n).replace(".", ",")} %`);

/**
 * Promena rabata kupca: jedan artikal, potvrđena grupa ili više izabranih
 * artikala. Prvo PREGLED (svi obuhvaćeni artikli, stari i novi rabat,
 * izuzeci), pa slanje. Pojedinačni dogovori u grupi se ne menjaju dok ih
 * korisnik izričito ne uključi.
 */
export function RebateChangePanel({
  customerId,
  customerName,
  today,
  articles,
  families,
  canApprove,
  initialArticleId,
}: {
  customerId: string;
  customerName: string;
  today: string;
  articles: ArticleOption[];
  families: Family[];
  canApprove: boolean;
  initialArticleId: string | null;
}) {
  const [mode, setMode] = useState<"jedan" | "grupa" | "vise">(initialArticleId ? "jedan" : families.length ? "grupa" : "jedan");
  const [articleId, setArticleId] = useState(initialArticleId ?? articles[0]?.articleId ?? "");
  const [groupKey, setGroupKey] = useState(families[0]?.key ?? "");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [percent, setPercent] = useState("");
  const [from, setFrom] = useState(today);
  const [reason, setReason] = useState("");
  const [include, setInclude] = useState<Set<string>>(new Set());
  const [approveNow, setApproveNow] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const family = families.find((f) => f.key === groupKey) ?? null;
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? articles.filter((a) => `${a.articleCode} ${a.articleName ?? ""}`.toLowerCase().includes(q)) : articles;
  }, [articles, filter]);

  const input = (inc = include) => ({
    customerId,
    mode: mode === "grupa" ? ("grupa" as const) : ("artikli" as const),
    articleIds: mode === "jedan" ? [articleId] : mode === "vise" ? [...picked] : [],
    groupKey: mode === "grupa" ? groupKey : undefined,
    newPercent: Number(percent.replace(",", ".")),
    effectiveFrom: from,
    includeExceptions: [...inc],
  });
  const runPreview = (inc = include) =>
    start(async () => {
      setMsg(null);
      const r = await previewChangeAction(input(inc));
      if (r.ok) setPreview(r.preview);
      else {
        setPreview(null);
        setMsg({ ok: false, text: r.error });
      }
    });
  const reset = () => {
    setPreview(null);
    setMsg(null);
  };
  const included = preview?.rows.filter((r) => r.included) ?? [];

  return (
    <div className="rc-change" id="predlog">
      <p className="rr-propose-who">
        Kupac: <strong>{customerName}</strong>
      </p>
      <fieldset className="rc-modes" onChange={reset}>
        <legend>Obuhvat promene</legend>
        <label>
          <input type="radio" name="obuhvat" checked={mode === "jedan"} onChange={() => setMode("jedan")} /> Jedan artikal
        </label>
        <label>
          <input type="radio" name="obuhvat" checked={mode === "grupa"} onChange={() => setMode("grupa")} disabled={!families.length} /> Potvrđena grupa proizvoda
          {!families.length ? <small> (fakture kupca ne dokazuju nijednu grupu)</small> : null}
        </label>
        <label>
          <input type="radio" name="obuhvat" checked={mode === "vise"} onChange={() => setMode("vise")} /> Više izabranih artikala
        </label>
      </fieldset>

      {mode === "jedan" ? (
        <label className="rr-field">
          <span>Artikal</span>
          <select value={articleId} onChange={(e) => { setArticleId(e.target.value); reset(); }}>
            {articles.map((a) => (
              <option key={a.articleId} value={a.articleId}>
                {a.articleCode} · {a.articleName ?? ""} {a.currentPercent ? `(važi ${a.currentPercent})` : a.lastPercent !== null ? `(poslednji ${a.lastPercent} %)` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {mode === "grupa" && family ? (
        <div className="rr-field">
          <span>Grupa</span>
          <select value={groupKey} onChange={(e) => { setGroupKey(e.target.value); reset(); }}>
            {families.map((f) => (
              <option key={f.key} value={f.key}>
                „{f.key}“ · sada {pct(f.percent)} · {f.members.length} artikala
              </option>
            ))}
          </select>
          <small>
            Poreklo: izvedena iz faktura ovog kupca (nije BizniSoft grupa) — {family.evidence.articles} artikala sa {pct(family.percent)} u {family.evidence.days} dana,{" "}
            {Math.round(family.evidence.share * 100)} % stavki ({family.evidence.window.join(" – ")}){family.evidence.actions ? `; akcija na fakturi: ${family.evidence.actions}` : ""}.
          </small>
          <details>
            <summary>Članstvo grupe ({family.members.length})</summary>
            <ul className="rc-articles">
              {family.members.map((m) => (
                <li key={m.articleId}>
                  {m.code} · {m.name}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}

      {mode === "vise" ? (
        <div className="rr-field">
          <span>Artikli ({picked.size} izabrano)</span>
          <input placeholder="Pretraga po šifri ili nazivu" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="rc-pick">
            {shown.slice(0, 300).map((a) => (
              <label key={a.articleId}>
                <input
                  type="checkbox"
                  checked={picked.has(a.articleId)}
                  onChange={(e) => {
                    const n = new Set(picked);
                    if (e.target.checked) n.add(a.articleId);
                    else n.delete(a.articleId);
                    setPicked(n);
                    reset();
                  }}
                />{" "}
                {a.articleCode} · {a.articleName ?? ""} <small>{a.currentPercent ? `važi ${a.currentPercent}` : a.lastPercent !== null ? `poslednji ${a.lastPercent} %` : ""}</small>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rc-inline">
        <label className="rr-field rr-field-short">
          <span>Novi rabat (%)</span>
          <input inputMode="decimal" value={percent} onChange={(e) => { setPercent(e.target.value); reset(); }} required />
        </label>
        <DateField name="effectiveFrom" label="Važi od" value={from} onChange={(iso) => { setFrom(iso); reset(); }} required />
      </div>
      <label className="rr-field">
        <span>Obrazloženje</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="npr. dogovor sa kupcem 10.10.2026, novi uslov za CS program" />
      </label>
      <button type="button" className="portal-button" data-variant="secondary" disabled={pending || !percent} onClick={() => runPreview()}>
        {pending && !preview ? "Računam…" : "Pregled promene"}
      </button>

      {preview ? (
        <div className="rc-preview">
          <h3>
            Pregled: {pct(preview.newPercent)} od {preview.effectiveFrom}
            {preview.group ? ` · grupa „${preview.group.key}“ (sada ${pct(preview.group.percent)})` : ""}
          </h3>
          <div className="portal-table-wrap">
            <table className="portal-table rr-table">
              <thead>
                <tr>
                  <th scope="col">Artikal</th>
                  <th scope="col">Sada važi</th>
                  <th scope="col">Poslednja faktura</th>
                  <th scope="col">Novo</th>
                  <th scope="col">Radnja</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.articleId} data-included={r.included ? "da" : "ne"}>
                    <th scope="row">
                      {r.articleCode}
                      <small>{r.articleName}</small>
                    </th>
                    <td data-label="Sada važi">
                      {r.current ? pct(r.current.percent) : "—"}
                      {r.current ? <small>{r.current.origin}, od {r.current.effectiveFrom}</small> : <small>nema pravila</small>}
                    </td>
                    <td data-label="Poslednja faktura">
                      {r.lastInvoice ? pct(r.lastInvoice.percent) : "—"}
                      {r.lastInvoice ? <small>{r.lastInvoice.label} · {r.lastInvoice.issuedOn}</small> : null}
                    </td>
                    <td data-label="Novo">{r.included ? pct(preview.newPercent) : "ne menja se"}</td>
                    <td data-label="Radnja">
                      <span className="kk-status" data-tone={r.action === "izuzetak" ? "warning" : r.included ? "success" : "neutral"}>
                        {ACTION[r.action]}
                      </span>
                      {r.note ? <small>{r.note}</small> : null}
                      {r.action === "izuzetak" && r.current && !/sukob|datum|zakazana/.test(r.note ?? "") ? (
                        <label className="rc-include">
                          <input
                            type="checkbox"
                            checked={include.has(r.articleId)}
                            onChange={(e) => {
                              const n = new Set(include);
                              if (e.target.checked) n.add(r.articleId);
                              else n.delete(r.articleId);
                              setInclude(n);
                              runPreview(n);
                            }}
                          />{" "}
                          uključi i ovaj pojedinačni dogovor
                        </label>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="portal-data-note">
            Menja se {included.length} od {preview.rows.length}: novo {included.filter((r) => !r.current).length}, zamena {included.filter((r) => r.current).length}
            {preview.rows.some((r) => r.action === "izuzetak" && !r.included) ? `; izuzeci koji ostaju: ${preview.rows.filter((r) => r.action === "izuzetak" && !r.included).length}` : ""}.
            Važeće pravilo ostaje do odobrenja; posle odobrenja se zatvara dan pre {preview.effectiveFrom}.
          </p>
          {canApprove ? (
            <label className="rc-include">
              <input type="checkbox" checked={approveNow} onChange={(e) => setApproveNow(e.target.checked)} /> Odobrite odmah (vlasnik)
            </label>
          ) : null}
          <button
            type="button"
            className="portal-button"
            disabled={pending || !included.length || reason.trim().length < 10}
            onClick={() =>
              start(async () => {
                const r = await submitChangeAction({
                  ...input(),
                  reason,
                  approveNow,
                  expected: included.map((x) => ({ articleId: x.articleId, replacesRuleId: x.current?.ruleId ?? null })),
                });
                if (r.ok) {
                  setPreview(null);
                  setInclude(new Set());
                  setMsg({ ok: true, text: r.message });
                } else setMsg({ ok: false, text: r.error });
              })
            }
          >
            {pending ? "Šaljem…" : approveNow ? `Odobrite promenu (${included.length})` : `Pošaljite na odobrenje (${included.length})`}
          </button>
          {reason.trim().length < 10 ? <small> Obrazloženje: najmanje 10 znakova.</small> : null}
        </div>
      ) : null}
      {msg ? <p className={msg.ok ? "portal-permission-ok" : "portal-login-error"} role="status">{msg.text}</p> : null}
    </div>
  );
}
