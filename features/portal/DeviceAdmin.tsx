"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  activateDeviceAction,
  registerDeviceAction,
  revokeDeviceAction,
  type SyncActionState,
} from "@/app/portal/importi/sinhronizacija/actions";

/**
 * Minimalna administracija uređaja — samo za `devices:manage`.
 *
 * Prima ISKLJUČIVO javni ključ, onakav kakav ispisuje `connector init` /
 * `export-key`. Privatni ključ se nikada ne unosi, ne prikazuje i ne šalje —
 * nastaje i ostaje na kancelarijskom računaru.
 *
 * Otisak računa server; ovde se pri aktivaciji samo POTVRĐUJE onaj koji je
 * čovek pročitao sa uređaja.
 */

const POCETNO: SyncActionState = { error: null, ok: null };

function Posalji({ tekst }: { tekst: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="portal-button" data-variant="secondary" disabled={pending}>
      {pending ? "…" : tekst}
    </button>
  );
}

function Poruka({ state }: { state: SyncActionState }) {
  if (state.error) {
    return (
      <p className="portal-readiness-note" data-tone="danger" role="alert">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="portal-readiness-note" data-tone="success">
        {state.ok}
      </p>
    );
  }
  return null;
}

export function DeviceAdmin() {
  const [reg, registruj] = useActionState(registerDeviceAction, POCETNO);
  const [akt, aktiviraj] = useActionState(activateDeviceAction, POCETNO);
  const [opo, opozovi] = useActionState(revokeDeviceAction, POCETNO);

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Uređaji — registracija i opoziv</h2>
          <p>
            Unosi se <strong>samo javni ključ</strong> iz <code>connector init</code> ili{" "}
            <code>connector export-key</code>. Privatni ključ ostaje na kancelarijskom računaru i
            nikada se ne unosi ovde. Otisak računa server; pri aktivaciji ga uporedite sa onim koji
            uređaj ispisuje.
          </p>
        </div>
      </div>

      <form action={registruj}>
        <label className="portal-field">
          <span>Oznaka uređaja</span>
          <input name="deviceCode" required maxLength={64} placeholder="office-pc-01" />
        </label>
        <label className="portal-field">
          <span>Naziv</span>
          <input name="label" required maxLength={120} placeholder="Kancelarija — glavni računar" />
        </label>
        <label className="portal-field">
          <span>Izvorni sistem</span>
          <input name="sourceSystem" required maxLength={64} defaultValue="biznisoft" />
        </label>
        <label className="portal-field">
          <span>Izdavalac</span>
          <input name="issuerCode" required maxLength={64} placeholder="QA01" />
        </label>
        <label className="portal-field">
          <span>Oznaka ključa</span>
          <input name="keyId" required maxLength={64} defaultValue="k1" />
        </label>
        <label className="portal-field">
          <span>Javni ključ (SPKI base64)</span>
          <input name="publicKeySpki" required placeholder="MCowBQYDK2VwAyEA…" />
        </label>
        <Posalji tekst="Registruj uređaj" />
      </form>
      <Poruka state={reg} />

      <form action={aktiviraj}>
        <label className="portal-field">
          <span>ID uređaja</span>
          <input name="deviceId" required placeholder="uuid" />
        </label>
        <label className="portal-field">
          <span>Oznaka ključa</span>
          <input name="keyId" required defaultValue="k1" />
        </label>
        <label className="portal-field">
          <span>Potvrđen otisak</span>
          <input name="expectedFingerprint" required placeholder="sha256:…" />
        </label>
        <Posalji tekst="Aktiviraj" />
      </form>
      <Poruka state={akt} />

      <form action={opozovi}>
        <label className="portal-field">
          <span>ID uređaja</span>
          <input name="deviceId" required placeholder="uuid" />
        </label>
        <label className="portal-field">
          <span>Razlog opoziva</span>
          <input name="reason" required minLength={3} maxLength={500} />
        </label>
        <Posalji tekst="Opozovi" />
      </form>
      <Poruka state={opo} />

      <p className="portal-readiness-note">
        Opoziv je trajan: opozvan uređaj se ne aktivira ponovo, nego se registruje nov. Istorija se
        ne briše. Pokrenut lokalni posao se opozivom ne prekida daljinski — naredni zahtevi uređaja
        se odbijaju.
      </p>
    </section>
  );
}
