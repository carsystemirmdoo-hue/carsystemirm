"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { NameProposal } from "@/lib/catalog/name-proposals";
import { confirmNameProposalsAction, saveArticleNoteAction } from "./actions";

/**
 * Predlozi po nazivu (2026-11-11). „Sigurno“ (provera unazad 529/530 tačno) može da se potvrdi
 * za ceo brend jednim klikom; ostalo red po red, uz izbor između kandidata.
 */

const ORDER = ["sigurno", "verovatno", "nejasno", "nema", "bez brenda"] as const;
const TITLE: Record<(typeof ORDER)[number], string> = {
  sigurno: "Sigurno",
  verovatno: "Verovatno",
  nejasno: "Nejasno — proverite",
  nema: "Bez predloga",
  "bez brenda": "Bez brenda u nazivu",
};
const HINT: Record<(typeof ORDER)[number], string> = {
  sigurno: "Šifra ili naziv se jasno poklapaju, a boja, RAL, sjaj/mat i šifra proizvoda se ne razlikuju. Litražu nosi sam artikal (kolona „Pakovanje“): 0,5 L i 1 L istog proizvoda su dva artikla na istoj kartici.",
  verovatno: "Naziv se dobro poklapa, ali drugi kandidat je blizu. Pogledajte pre potvrde.",
  nejasno: "Više sličnih proizvoda ili varijanti, ili se boja/RAL/šifra razlikuju. Izaberite tačan, ili u „Vaš opis“ napišite koji je to artikal.",
  nema: "U katalogu sajta nema sličnog proizvoda tog brenda — verovatno nema karticu na sajtu.",
  "bez brenda": "Naziv ne počinje brendom (npr. „BLANKO POSUDA“), pa predlog ne zna gde da traži.",
};
const BRAND: Record<string, string> = { carsystem: "Carsystem", "cosmos-lac": "Cosmos Lac", "r-m": "R-M", baslac: "Baslac", befar: "Befar", carfit: "C.A.R.FIT", norbin: "Norbin", sata: "SATA" };
const fmt = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 2 });
const href = (c: { slug: string; variant: string | null }) => `/proizvodi/${c.slug}${c.variant ? `?varijanta=${encodeURIComponent(c.variant)}` : ""}`;

/** „Vaš opis“: slobodan tekst koji je to artikal (ne povezuje ništa — čuva se za pregled). */
function NoteField({ p }: { p: NameProposal }) {
  const router = useRouter();
  const [text, setText] = useState(p.ownerNote?.text ?? "");
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = text.trim() !== (p.ownerNote?.text ?? "");
  return (
    <div className="np-note">
      <textarea
        rows={2}
        maxLength={500}
        value={text}
        placeholder="Npr. crni sunđer 150×45 na M14 adapteru"
        aria-label={`Opis artikla ${p.code}`}
        onChange={(e) => {
          setText(e.target.value);
          setState(null);
        }}
      />
      <div className="np-note-row">
        <button
          type="button"
          className="np-btn"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              const r = await saveArticleNoteAction({ articleId: p.articleId, text });
              setState(r.error ? { ok: false, text: r.error } : { ok: true, text: r.ok ?? "Sačuvano." });
              router.refresh();
            })
          }
        >
          Sačuvaj opis
        </button>
        {state ? <small className={state.ok ? "np-ok-inline" : "np-err-inline"}>{state.text}</small> : p.ownerNote && !dirty ? <small>{p.ownerNote.by}, {p.ownerNote.at.slice(8, 10)}.{p.ownerNote.at.slice(5, 7)}.</small> : null}
      </div>
    </div>
  );
}

export function NameProposals({ proposals, includeInactive }: { proposals: NameProposal[]; includeInactive: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pick, setPick] = useState<Record<string, number>>({});
  const groups = useMemo(() => {
    const m = new Map<string, NameProposal[]>();
    for (const p of proposals) m.set(p.confidence, [...(m.get(p.confidence) ?? []), p]);
    for (const list of m.values()) list.sort((a, b) => (a.brand ?? "").localeCompare(b.brand ?? "") || b.sold12m - a.sold12m);
    return m;
  }, [proposals]);

  const confirm = (items: { articleId: string; slug: string; variant: string | null }[]) =>
    start(async () => {
      setMsg(null);
      const r = await confirmNameProposalsAction(items);
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: r.ok ?? "Sačuvano." });
      router.refresh();
    });

  const sure = groups.get("sigurno") ?? [];
  const sureByBrand = new Map<string, NameProposal[]>();
  for (const p of sure) sureByBrand.set(p.brand ?? "", [...(sureByBrand.get(p.brand ?? "") ?? []), p]);

  return (
    <section className="portal-panel np">
      <div className="np-head">
        <div>
          <h2>Predlozi po nazivu ({proposals.length})</h2>
          <p>
            Artikli {includeInactive ? "bez veze" : "koji se prodaju (12 meseci), a nemaju vezu"}, bez artikala van programa. Predlog nije veza: artikal se
            povezuje tek kada kliknete „Potvrdi“, a svaka potvrda se beleži u Aktivnostima kao Vaša.
          </p>
        </div>
        <Link className="np-toggle" href={includeInactive ? "/portal/proizvodi/mapiranja" : "/portal/proizvodi/mapiranja?predlozi=svi"}>
          {includeInactive ? "Samo artikli koji se prodaju" : "Prikaži i artikle bez prodaje"}
        </Link>
      </div>
      {msg ? <p className={msg.ok ? "np-ok" : "np-err"} role="status">{msg.text}</p> : null}

      {sure.length ? (
        <div className="np-bulk">
          {[...sureByBrand].map(([b, list]) => (
            <button
              key={b}
              type="button"
              className="np-btn np-btn-primary"
              disabled={pending}
              onClick={() => {
                if (window.confirm(`Potvrditi ${list.length} sigurnih veza za ${BRAND[b] ?? b}?`)) confirm(list.map((p) => ({ articleId: p.articleId, slug: p.candidates[0].slug, variant: p.candidates[0].variant })));
              }}
            >
              Potvrdi sve sigurne — {BRAND[b] ?? b} ({list.length})
            </button>
          ))}
        </div>
      ) : null}

      {ORDER.map((k) => {
        const list = groups.get(k) ?? [];
        if (!list.length) return null;
        return (
          <details key={k} className="np-group" open={k === "sigurno" || k === "verovatno"}>
            <summary>
              <b>{TITLE[k]}</b> <span className="np-count">{list.length}</span>
              <small>{HINT[k]}</small>
            </summary>
            <div className="portal-table-wrap">
              <table className="portal-table np-table">
                <thead>
                  <tr>
                    <th scope="col">Šifra</th>
                    <th scope="col">Naziv u BizniSoftu</th>
                    <th scope="col">Pakovanje</th>
                    <th scope="col">Prodato 12 m</th>
                    <th scope="col">Predlog na sajtu</th>
                    <th scope="col" aria-label="Potvrda" />
                    <th scope="col">Vaš opis</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const i = pick[p.articleId] ?? 0;
                    const c = p.candidates[i];
                    return (
                      <tr key={p.articleId}>
                        <td><code className="lg-code">{p.code}</code></td>
                        <td>
                          {p.name}
                          <small>{BRAND[p.brand ?? ""] ?? "—"}</small>
                        </td>
                        <td className="np-pack">{p.pack || "—"}</td>
                        <td className="portal-table-number">{p.sold12m ? `${fmt(p.sold12m)} ${p.unit ?? ""}` : "—"}</td>
                        <td>
                          {p.candidates.length === 0 ? (
                            "—"
                          ) : p.candidates.length === 1 || k === "sigurno" ? (
                            <>
                              <a href={href(c)} target="_blank" rel="noreferrer">{c.label}</a>
                              {c.doubts.length ? <small className="np-doubt">Proverite: {c.doubts.join(", ")}</small> : null}
                            </>
                          ) : (
                            <div className="np-cands">
                              {p.candidates.map((x, j) => (
                                <label key={j}>
                                  <input type="radio" name={`c-${p.articleId}`} checked={i === j} onChange={() => setPick((s) => ({ ...s, [p.articleId]: j }))} />
                                  <a href={href(x)} target="_blank" rel="noreferrer">{x.label}</a>
                                  <small>ocena {x.score}</small>
                                  {x.doubts.length ? <small className="np-doubt">{x.doubts.join(", ")}</small> : null}
                                </label>
                              ))}
                            </div>
                          )}
                          {p.shared ? <small className="np-doubt">Isti predlog ima još jedan artikal sa istim nazivom — samo jedan može biti tačan.</small> : null}
                        </td>
                        <td>
                          {c ? (
                            <button type="button" className="np-btn" disabled={pending} onClick={() => confirm([{ articleId: p.articleId, slug: c.slug, variant: c.variant }])}>
                              Potvrdi
                            </button>
                          ) : null}
                        </td>
                        <td>
                          <NoteField p={p} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </details>
        );
      })}
    </section>
  );
}
