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

export type DeviceChoice = { id: string; label: string; deviceCode: string; status: string };

/**
 * Izbor uređaja umesto ručnog upisa UUID-a.
 *
 * UUID se nigde na strani ne prikazuje; ranije je aktivacija tražila da se
 * prepiše iz baze (otkriveno na generalnoj probi talasa 01). Server i dalje
 * proverava i sposobnost i otisak — izbor je samo pomoć pri unosu.
 */
function DeviceSelect({ devices, empty }: { devices: DeviceChoice[]; empty: string }) {
  if (devices.length === 0) {
    return (
      <select name="deviceId" required disabled defaultValue="">
        <option value="">{empty}</option>
      </select>
    );
  }
  return (
    <select name="deviceId" required defaultValue={devices.length === 1 ? devices[0].id : ""}>
      {devices.length > 1 ? <option value="">izaberite uređaj</option> : null}
      {devices.map((d) => (
        <option key={d.id} value={d.id}>
          {d.label} · {d.deviceCode} ({d.status})
        </option>
      ))}
    </select>
  );
}

export function DeviceAdmin({ devices = [] }: { devices?: DeviceChoice[] }) {
  const zaAktivaciju = devices.filter((d) => d.status === "registered");
  const zaOpoziv = devices.filter((d) => d.status !== "revoked");
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

      {/*
        * Tri KORAKA, ne tri forme jedna ispod druge.
        *
        * Registracija, aktivacija i opoziv su odvojene odluke i dešavaju se u
        * različitim trenucima. Bez vidljive granice čovek koji prvi put vezuje
        * uređaj ne zna gde jedan posao prestaje — a otisak se potvrđuje tek
        * pošto ga uređaj ispiše, dakle nikad u istom dahu sa registracijom.
        */}
      <div className="portal-device-steps">
        <section className="portal-device-step">
          <h3>
            <span className="portal-device-step-num">1</span> Registracija
          </h3>
          <p>Uređaj ulazi kao neaktivan. Registracija sama po sebi ništa ne otvara.</p>
          <form action={registruj} className="portal-device-form">
            <div className="portal-form-grid">
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
              <label className="portal-field" data-span="2">
                <span>Javni ključ (SPKI base64)</span>
                <input name="publicKeySpki" required placeholder="MCowBQYDK2VwAyEA…" />
                <small>
                  Iz <code>connector init</code>. Privatni deo nema polje u koje bi stao.
                </small>
              </label>
            </div>
            <Posalji tekst="Registrujte uređaj" />
          </form>
          <Poruka state={reg} />
        </section>

        <section className="portal-device-step">
          <h3>
            <span className="portal-device-step-num">2</span> Aktivacija
          </h3>
          <p>
            Otisak se <strong>upoređuje sa onim koji uređaj ispisuje</strong>. Bez te potvrde
            aktivacija bi bila klik na ono što je već u bazi — a upravo bi ubačen tuđi ključ tako
            i prošao.
          </p>
          <form action={aktiviraj} className="portal-device-form">
            <div className="portal-form-grid" data-columns="3">
              <label className="portal-field">
                <span>Uređaj</span>
                <DeviceSelect devices={zaAktivaciju} empty="nema uređaja koji čeka aktivaciju" />
              </label>
              <label className="portal-field">
                <span>Oznaka ključa</span>
                <input name="keyId" required defaultValue="k1" />
              </label>
              <label className="portal-field">
                <span>Potvrđen otisak</span>
                <input name="expectedFingerprint" required placeholder="sha256:…" />
              </label>
            </div>
            <Posalji tekst="Aktivirajte" />
          </form>
          <Poruka state={akt} />
        </section>

        <section className="portal-device-step" data-tone="danger">
          <h3>
            <span className="portal-device-step-num">3</span> Opoziv
          </h3>
          <p>Trajan. Opozvan uređaj se ne aktivira ponovo — registruje se nov.</p>
          <form action={opozovi} className="portal-device-form">
            <div className="portal-form-grid">
              <label className="portal-field">
                <span>Uređaj</span>
                <DeviceSelect devices={zaOpoziv} empty="nema uređaja za opoziv" />
              </label>
              <label className="portal-field">
                <span>Razlog opoziva</span>
                <input name="reason" required minLength={3} maxLength={500} />
              </label>
            </div>
            <Posalji tekst="Opozovite" />
          </form>
          <Poruka state={opo} />
        </section>
      </div>

      <p className="portal-readiness-note">
        Opoziv je trajan: opozvan uređaj se ne aktivira ponovo, nego se registruje nov. Istorija se
        ne briše. Pokrenut lokalni posao se opozivom ne prekida daljinski — naredni zahtevi uređaja
        se odbijaju.
      </p>
    </section>
  );
}
