"use client";

import { useActionState } from "react";
import {
  discardDraftAction,
  returnDraftAction,
  sendToOfficeAction,
  sendToOwnerAction,
  uploadVpExcelAction,
  type VpActionState,
} from "./actions";

const INITIAL: VpActionState = { error: null, ok: null };

function Status({ state }: { state: VpActionState }) {
  if (state.error) return <p className="portal-login-error" role="alert">{state.error}</p>;
  if (state.ok) return <p className="portal-permission-ok" role="status">{state.ok}</p>;
  return null;
}

/** Excel sa kolonom „Nova VP“ → nova priprema. Ništa se ne primenjuje. */
export function VpExcelUploadForm() {
  const [state, action, pending] = useActionState(uploadVpExcelAction, INITIAL);
  return (
    <form action={action} className="portal-settings-form">
      <label>
        <span>Excel sa novim cenama (.xlsx)</span>
        <input type="file" name="fajl" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required disabled={pending} />
        <small>Preuzmite važeći cenovnik, upišite nove cene u kolonu „Nova VP“ i otpremite ga ovde. Prazna „Nova VP“ = cena ostaje ista. Artikli se prepoznaju samo po šifri.</small>
      </label>
      <label>
        <span>Naziv pripreme (neobavezno)</span>
        <input type="text" name="naziv" maxLength={120} placeholder="npr. R-M +4 % od 1.12." disabled={pending} />
      </label>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>{pending ? "Čitam Excel…" : "Otpremite kao pripremu"}</button>
      <Status state={state} />
    </form>
  );
}

/** Menadžer prodaje: pošalji kancelariji / odbaci (samo dok je u pripremi). */
export function PrepareStageForms({ id, canSend }: { id: string; canSend: boolean }) {
  const [sent, send, sending] = useActionState(sendToOfficeAction, INITIAL);
  const [dropped, drop, dropping] = useActionState(discardDraftAction, INITIAL);
  return (
    <div className="vp-stage-forms">
      <form action={send} className="portal-settings-form">
        <input type="hidden" name="id" value={id} />
        <label>
          <span>Napomena za kancelariju (neobavezno)</span>
          <input type="text" name="napomena" maxLength={1000} disabled={sending} />
        </label>
        <button type="submit" className="portal-button" data-variant="primary" disabled={sending || !canSend}>
          {sending ? "Šaljem…" : "Pošaljite kancelariji"}
        </button>
        <Status state={sent} />
      </form>
      <form action={drop} className="portal-settings-form">
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="portal-button" data-variant="secondary" disabled={dropping}>Odbacite pripremu</button>
        <Status state={dropped} />
      </form>
    </div>
  );
}

/** Kancelarija: pošalji vlasniku ili vrati na doradu. */
export function OfficeStageForms({ id }: { id: string }) {
  const [owner, toOwner, sendingOwner] = useActionState(sendToOwnerAction, INITIAL);
  const [ret, doReturn, returning] = useActionState(returnDraftAction, INITIAL);
  return (
    <div className="vp-stage-forms">
      <form action={toOwner} className="portal-settings-form">
        <input type="hidden" name="id" value={id} />
        <label className="portal-checkbox">
          <input type="checkbox" name="provereno" value="da" required disabled={sendingOwner} />
          <span>Proverila sam stare i nove cene</span>
        </label>
        <label>
          <span>Napomena za vlasnika (neobavezno)</span>
          <input type="text" name="napomena" maxLength={1000} disabled={sendingOwner} placeholder="npr. uneto u BizniSoft 20.11." />
        </label>
        <button type="submit" className="portal-button" data-variant="primary" disabled={sendingOwner}>{sendingOwner ? "Šaljem…" : "Pošaljite vlasniku"}</button>
        <Status state={owner} />
      </form>
      <form action={doReturn} className="portal-settings-form">
        <input type="hidden" name="id" value={id} />
        <label>
          <span>Šta treba ispraviti</span>
          <input type="text" name="napomena" minLength={5} maxLength={1000} required disabled={returning} />
        </label>
        <button type="submit" className="portal-button" data-variant="secondary" disabled={returning}>Vratite na doradu</button>
        <Status state={ret} />
      </form>
    </div>
  );
}
