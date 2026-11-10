"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { addCallNoteAction, completeFollowUpAction, saveContactAction } from "@/app/portal/kupci/[id]/preporuke/deskActions";
import type { CustomerDesk as Desk } from "@/lib/sales-tools/customer-desk-service";
import { CALL_OUTCOMES, FOLLOW_UP_CHOICES, telHref } from "@/lib/sales-tools/customerDesk.mjs";
import styles from "./CustomerDesk.module.css";

/**
 * Traka kupca (2026-11-10): poziv jednim dodirom, dugovanje iz tabele kancelarije i beleška
 * posle razgovora sa podsetnikom. Velika dugmad i kratki tekstovi — radi i sa telefona.
 */

const money = (n: number) => n.toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const whole = (n: number) => n.toLocaleString("sr-Latn-RS", { maximumFractionDigits: 0 });
const dmy = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}.` : "—");
const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
const dmyTime = (s: string) => `${dm(s.slice(0, 10))} ${s.slice(11, 16)}`;

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function CustomerDesk({ customerId, desk, showDebt }: { customerId: string; desk: Desk; showDebt: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const noteDlg = useRef<HTMLDialogElement>(null);
  const contactDlg = useRef<HTMLDialogElement>(null);
  const debtDlg = useRef<HTMLDialogElement>(null);
  const [outcome, setOutcome] = useState<string>("");
  const [body, setBody] = useState("");
  const [days, setDays] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const c = desk.contact;
  const [form, setForm] = useState({ contactName: c?.contactName ?? "", phone: c?.phone ?? "", phoneAlt: c?.phoneAlt ?? "", email: c?.email ?? "", note: c?.note ?? "" });

  const openNote = (preset?: string) => {
    setOutcome(preset ?? "");
    setBody("");
    setDays(preset === "javice_se" ? 3 : 0);
    setMsg(null);
    noteDlg.current?.showModal();
  };
  const saveNote = () =>
    start(async () => {
      const res = await addCallNoteAction({ customerId, outcome, body, followUpDays: days });
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      noteDlg.current?.close();
      setMsg({ ok: true, text: "Razgovor je zabeležen." });
      router.refresh();
    });
  const saveContact = () =>
    start(async () => {
      const res = await saveContactAction({ customerId, ...form });
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      contactDlg.current?.close();
      setMsg({ ok: true, text: "Kontakt je sačuvan." });
      router.refresh();
    });
  const done = (noteId: string) =>
    start(async () => {
      const res = await completeFollowUpAction({ customerId, noteId });
      setMsg(res.ok ? { ok: true, text: "Podsetnik je završen." } : { ok: false, text: res.error });
      router.refresh();
    });

  const last = desk.notes[0] ?? null;
  const follow = desk.openFollowUp;
  const debt = desk.debt;

  return (
    <>
      {msg ? <p className={`${styles.msg} ${msg.ok ? "" : styles.err}`} role="status">{msg.text}</p> : null}
      <section className={styles.desk} aria-label="Kontakt, dugovanje i razgovori">
        <div className={styles.box}>
          <span className={styles.lbl}>Pozovite</span>
          {c?.contactName ? <span className={styles.who}>{c.contactName}</span> : null}
          <div className={styles.calls}>
            {desk.phones.length ? (
              desk.phones.slice(0, 3).map((p) => (
                <a key={p.number} className={styles.call} href={telHref(p.number) ?? undefined} title={p.source}>
                  <PhoneIcon />
                  {p.number}
                </a>
              ))
            ) : (
              <span className={styles.muted}>Telefon nije upisan.</span>
            )}
          </div>
          <button type="button" className={styles.link} onClick={() => { setMsg(null); contactDlg.current?.showModal(); }}>
            {desk.phones.length ? "Izmeni kontakt" : "Upišite telefon"}
          </button>
        </div>

        {showDebt ? (
          <div className={styles.box}>
            <span className={styles.lbl}>Dugovanje</span>
            {debt.checkedAt === null ? (
              <span className={styles.muted}>Tabela dugovanja još nije povezana.</span>
            ) : debt.lines.length === 0 ? (
              <span className={styles.ok}>Nema otvorenih faktura</span>
            ) : (
              <>
                <button type="button" className={`${styles.debt} ${debt.overdueTotal > 0 ? styles.debtLate : ""}`} onClick={() => debtDlg.current?.showModal()}>
                  <strong>{whole(debt.total)} RSD</strong>
                  <span>
                    {debt.lines.length} {debt.lines.length === 1 ? "faktura" : debt.lines.length < 5 ? "fakture" : "faktura"}
                    {debt.maxDaysOverdue ? ` · kasni do ${debt.maxDaysOverdue} d` : " · ništa nije dospelo"}
                  </span>
                </button>
                {debt.overdueTotal > 0 ? <span className={styles.small}>Dospelo: {whole(debt.overdueTotal)} RSD</span> : null}
              </>
            )}
            {debt.checkedAt ? <span className={styles.small}>Stanje iz tabele kancelarije, {dmyTime(debt.checkedAt)}</span> : null}
          </div>
        ) : null}

        <div className={`${styles.box} ${styles.talk}`}>
          <span className={styles.lbl}>Razgovor</span>
          {follow ? (
            <div className={`${styles.follow} ${follow.followUpOn! <= desk.today ? styles.followDue : ""}`}>
              <span>
                Javiti se: <b>{follow.followUpOn === desk.today ? "danas" : dmy(follow.followUpOn)}</b>
                {follow.body ? ` — ${follow.body}` : ""}
              </span>
              <button type="button" className={styles.smallBtn} onClick={() => done(follow.id)} disabled={pending}>Urađeno</button>
            </div>
          ) : null}
          {last ? (
            <span className={styles.small}>
              Poslednji: {dmyTime(last.at)} · <b>{last.outcomeLabel}</b>
              {last.body ? ` — ${last.body}` : ""} ({last.by})
            </span>
          ) : (
            <span className={styles.muted}>Još nema zabeleženih razgovora.</span>
          )}
          <div className={styles.row}>
            <button type="button" className={styles.big} onClick={() => openNote()}>Zabeleži razgovor</button>
            {desk.notes.length > 1 ? (
              <button type="button" className={styles.link} onClick={() => setShowAll(!showAll)} aria-expanded={showAll}>
                {showAll ? "Sakrij razgovore" : `Svi razgovori (${desk.notes.length})`}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {showAll ? (
        <section className={styles.history} aria-label="Svi razgovori">
          <ul>
            {desk.notes.map((n) => (
              <li key={n.id}>
                <span className={styles.when}>{dmyTime(n.at)}</span>
                <b>{n.outcomeLabel}</b>
                {n.body ? <span> — {n.body}</span> : null}
                {n.followUpOn ? <span className={styles.small}> · podsetnik {dmy(n.followUpOn)}{n.done ? " (urađeno)" : ""}</span> : null}
                <span className={styles.small}> · {n.by}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dialog ref={noteDlg} className={styles.dialog} aria-labelledby="razgovor-naslov">
        <form className={styles.dlg} onSubmit={(e) => { e.preventDefault(); saveNote(); }}>
          <h2 id="razgovor-naslov">Kako je prošao razgovor?</h2>
          <div className={styles.choices} role="radiogroup" aria-label="Ishod">
            {CALL_OUTCOMES.map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={outcome === k} className={outcome === k ? styles.on : undefined}
                onClick={() => { setOutcome(k); if (k === "javice_se" && days === 0) setDays(3); }}>
                {l}
              </button>
            ))}
          </div>
          <label className={styles.field}>
            Beleška {outcome === "drugo" ? "" : "(neobavezno)"}
            <textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} placeholder="npr. hoće klar u petak, pitao za popust na brusni papir" />
          </label>
          <div className={styles.field}>
            Podseti me da se javim
            <div className={styles.choices}>
              {FOLLOW_UP_CHOICES.map(([d, l]) => (
                <button key={d} type="button" aria-pressed={days === d} className={days === d ? styles.on : undefined} onClick={() => setDays(d)}>{l}</button>
              ))}
            </div>
          </div>
          {msg && !msg.ok ? <p className={`${styles.msg} ${styles.err}`} role="alert">{msg.text}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => noteDlg.current?.close()}>Odustani</button>
            <button type="submit" className={`${styles.btn} ${styles.dark}`} disabled={pending || !outcome}>{pending ? "Čuvam…" : "Sačuvaj"}</button>
          </div>
        </form>
      </dialog>

      <dialog ref={contactDlg} className={styles.dialog} aria-labelledby="kontakt-naslov">
        <form className={styles.dlg} onSubmit={(e) => { e.preventDefault(); saveContact(); }}>
          <h2 id="kontakt-naslov">Kontakt kupca</h2>
          <p>Vidite ga Vi, vlasnik i kancelarija. Kupac ga ne vidi.</p>
          {(
            [
              ["contactName", "Kontakt osoba", "npr. Mika (vlasnik)", "text"],
              ["phone", "Telefon", "npr. 063 123 4567", "tel"],
              ["phoneAlt", "Drugi telefon (neobavezno)", "npr. 022 123 456", "tel"],
              ["email", "E-pošta (neobavezno)", "", "email"],
              ["note", "Napomena (neobavezno)", "npr. zvati posle 10h", "text"],
            ] as const
          ).map(([k, l, ph, type]) => (
            <label key={k} className={styles.field}>
              {l}
              <input type={type} value={form[k]} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          {desk.emails.length || desk.accounts.length ? (
            <p className={styles.small}>
              {desk.accounts.length ? `Nalozi na sajtu: ${desk.accounts.join(", ")}. ` : ""}
              {desk.emails.length ? `E-pošta iz evidencije: ${desk.emails.join(", ")}` : ""}
            </p>
          ) : null}
          {msg && !msg.ok ? <p className={`${styles.msg} ${styles.err}`} role="alert">{msg.text}</p> : null}
          <div className={styles.actions}>
            <button type="button" className={styles.btn} onClick={() => contactDlg.current?.close()}>Odustani</button>
            <button type="submit" className={`${styles.btn} ${styles.dark}`} disabled={pending}>{pending ? "Čuvam…" : "Sačuvaj"}</button>
          </div>
        </form>
      </dialog>

      {showDebt ? (
        <dialog ref={debtDlg} className={`${styles.dialog} ${styles.wide}`} aria-labelledby="dug-naslov">
          <div className={styles.dlg}>
            <h2 id="dug-naslov">Otvorene fakture</h2>
            <p>Iz tabele kancelarije{debt.checkedAt ? ` (${dmyTime(debt.checkedAt)})` : ""}. Fakture kojih nema u tabeli su plaćene.</p>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Faktura</th><th>Datum</th><th>Valuta</th><th className={styles.num}>Iznos</th><th className={styles.num}>Uplaćeno</th><th className={styles.num}>Ostatak</th></tr>
                </thead>
                <tbody>
                  {debt.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.invoiceNumber ?? "—"}{l.note ? <span className={styles.small}> {l.note}</span> : null}</td>
                      <td>{dmy(l.issuedOn)}</td>
                      <td>
                        {dmy(l.dueOn)}
                        {l.daysOverdue !== null && l.daysOverdue > 0 ? <span className={styles.late}> kasni {l.daysOverdue} d</span> : null}
                      </td>
                      <td className={styles.num}>{l.amount === null ? "—" : money(l.amount)}</td>
                      <td className={styles.num}>{l.paid === null ? "—" : money(l.paid)}</td>
                      <td className={`${styles.num} ${styles.strong}`}>{money(l.remaining)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr><td colSpan={5}>Ukupno</td><td className={`${styles.num} ${styles.strong}`}>{money(debt.total)}</td></tr>
                </tfoot>
              </table>
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.btn} onClick={() => debtDlg.current?.close()}>Zatvori</button>
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
