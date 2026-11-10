"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { previewRepOrderAction, submitRepOrderAction } from "./deskActions";
import styles from "./CustomerOffer.module.css";

/**
 * Zahtev u ime kupca (2026-11-10). Komercijalista je sa kupcem dogovorio robu; ovde unosi
 * količine (u JM kao na fakturi, predlog = poslednja kupovina), bira opciju plaćanja i šalje
 * kancelariji. Cene računa server, istim pravilima kao za kupca; poklopac ide uz posudu sam.
 */

export type RepOrderItem = { articleId: string; code: string; name: string; unit: string | null; quantity: number; lid: { id: string; code: string; name: string } | null };

type Preview = Extract<Awaited<ReturnType<typeof previewRepOrderAction>>, { ok: true }>["preview"];

const money = (n: number) => n.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (p: number | null) => (p === null ? "—" : `${String(Math.round(p * 100) / 100).replace(".", ",")} %`);

export function RepOrderDialog({ customerId, items, phone, onClose }: { customerId: string; items: RepOrderItem[]; phone: string | null; onClose: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const key = useRef<string>(crypto.randomUUID());
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.articleId, String(i.quantity || 1).replace(".", ",")])));
  const [option, setOption] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [contact, setContact] = useState(phone ?? "");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ orderId: string; requestNumber: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    dlg.current?.showModal();
  }, []);

  const num = (s: string) => {
    const n = Number(String(s).replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const lines = useCallback(() => {
    const out: { articleId: string; quantity: number }[] = [];
    for (const i of items) {
      const q = num(qty[i.articleId] ?? "0");
      if (q <= 0) continue;
      out.push({ articleId: i.articleId, quantity: q });
      if (i.lid) out.push({ articleId: i.lid.id, quantity: q });
    }
    // Isti poklopac uz dve posude: jedna stavka sa zbirom.
    const merged = new Map<string, number>();
    for (const l of out) merged.set(l.articleId, (merged.get(l.articleId) ?? 0) + l.quantity);
    return [...merged].map(([articleId, quantity]) => ({ articleId, quantity }));
  }, [items, qty]);

  useEffect(() => {
    if (sent) return;
    const t = setTimeout(async () => {
      const res = await previewRepOrderAction({ customerId, lines: lines(), paymentOption: option });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setPreview(res.preview);
      if (option === null && res.preview.selected) setOption(res.preview.selected);
    }, 300);
    return () => clearTimeout(t);
  }, [customerId, lines, option, sent]);

  const step = (id: string, d: number) => setQty((q) => ({ ...q, [id]: String(Math.max(0, Math.round((num(q[id] ?? "0") + d) * 1000) / 1000)).replace(".", ",") }));
  const problems = preview ? [...preview.lines.filter((l) => l.problem).map((l) => `${l.code}: ${l.problem}`), ...preview.pairProblems] : [];
  const canSend = Boolean(preview && preview.lines.length && !problems.length && !pending);

  const send = () =>
    start(async () => {
      const res = await submitRepOrderAction({ customerId, idempotencyKey: key.current, lines: lines(), paymentOption: option, note, contactPhone: contact });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setSent({ orderId: res.orderId, requestNumber: res.requestNumber });
    });

  const byId = new Map(preview?.lines.map((l) => [l.articleId, l]) ?? []);

  return (
    <dialog ref={dlg} className={`${styles.dialog} ${styles.orderDialog}`} aria-labelledby="zahtev-naslov" onClose={onClose}>
      <div className={styles.dlg}>
        {sent ? (
          <>
            <h2 id="zahtev-naslov">Zahtev je poslat</h2>
            <p className={styles.sentText}>
              Zahtev <b>{sent.requestNumber}</b> je kod kancelarije. Kupac ga vidi među svojim zahtevima, a kancelarija ga obrađuje kao svaki drugi.
            </p>
            <div className={styles.actions}>
              <Link className={styles.button} href={`/portal/zahtevi/${sent.orderId}`} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Otvori zahtev</Link>
              <button type="button" className={`${styles.button} ${styles.dark}`} onClick={() => dlg.current?.close()}>Gotovo</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="zahtev-naslov">Pošalji zahtev za kupca</h2>
            <p>Unesite količine koje je kupac tražio. Cene su one koje kupac dobija danas.</p>
            <div className={styles.orderLines}>
              {items.map((i) => {
                const p = byId.get(i.articleId);
                return (
                  <div key={i.articleId} className={styles.orderLine}>
                    <div className={styles.orderName}>
                      <span className={styles.name}>{i.name}</span>
                      <span className={styles.sub}>
                        {i.code}
                        {i.lid ? ` · ide i poklopac ${i.lid.code}` : ""}
                        {p ? (p.netPrice !== null ? ` · ${money(p.netPrice)} (rabat ${pct(p.discountPercent)})` : " · cena na upit") : ""}
                      </span>
                      {p?.problem ? <span className={styles.lineProblem}>{p.problem}</span> : null}
                    </div>
                    <div className={styles.stepper}>
                      <button type="button" onClick={() => step(i.articleId, -1)} aria-label={`Manje: ${i.name}`}>−</button>
                      <input inputMode="decimal" value={qty[i.articleId] ?? ""} onChange={(e) => setQty({ ...qty, [i.articleId]: e.target.value })} aria-label={`Količina: ${i.name}`} />
                      <button type="button" onClick={() => step(i.articleId, 1)} aria-label={`Više: ${i.name}`}>+</button>
                      <span className={styles.unit}>{i.unit ?? ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {preview && preview.options.length > 1 ? (
              <label className={styles.field}>
                Plaćanje
                <select value={option ?? ""} onChange={(e) => setOption(e.target.value || null)}>
                  {preview.options.map((o) => <option key={o.code ?? "-"} value={o.code ?? ""}>{o.label}</option>)}
                </select>
              </label>
            ) : preview?.options[0] ? (
              <p className={styles.sub}>Plaćanje: {preview.options[0].label}</p>
            ) : null}
            <label className={styles.field}>
              Telefon za isporuku (neobavezno)
              <input className={styles.input} value={contact} onChange={(e) => setContact(e.target.value)} maxLength={40} />
            </label>
            <label className={styles.field}>
              Napomena za kancelariju (neobavezno)
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="npr. kupac preuzima lično u četvrtak" />
            </label>
            {preview ? (
              <p className={styles.total}>
                Ukupno bez PDV-a: <b>{money(preview.net)}</b> RSD · sa PDV-om <b>{money(preview.gross)}</b> RSD
                {preview.lines.some((l) => l.onRequest) ? " · stavke „na upit“ nisu u zbiru" : ""}
              </p>
            ) : (
              <p className={styles.sub}>Računam cene…</p>
            )}
            {problems.length ? <p className={`${styles.msg} ${styles.err}`} role="alert">{problems.join(" · ")}</p> : null}
            {error ? <p className={`${styles.msg} ${styles.err}`} role="alert">{error}</p> : null}
            <div className={styles.actions}>
              <button type="button" className={styles.button} onClick={() => dlg.current?.close()}>Odustani</button>
              <button type="button" className={`${styles.button} ${styles.primary}`} onClick={send} disabled={!canSend}>{pending ? "Šaljem…" : "Pošalji kancelariji"}</button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
