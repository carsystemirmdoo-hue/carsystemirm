"use client";

import { useActionState, useState } from "react";
import {
  changeRoleAction,
  createUserAction,
  togglePermissionAction,
  type AdminActionState,
} from "@/app/portal/dozvole/actions";
import {
  PERMISSION_PACKAGES,
  ROLE_LABELS,
  ROLES,
} from "@/lib/authz/permissions.mjs";
import { ESCALATION_PACKAGES } from "@/lib/authz/owner-guard-policy.mjs";

const INITIAL: AdminActionState = { error: null, ok: null };

interface MatrixUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  role: string;
  active: boolean;
  permissions: string[];
}

export function PermissionMatrix({
  users,
  canManage,
  actorId,
}: {
  users: MatrixUser[];
  canManage: boolean;
  actorId: string;
}) {
  const [toggleState, toggleAction, togglePending] = useActionState(
    togglePermissionAction,
    INITIAL,
  );
  const [roleState, roleAction, rolePending] = useActionState(
    changeRoleAction,
    INITIAL,
  );
  // Razlog je uslov za svaku izmenu — bez njega trag revizije ne bi objasnio
  // zašto je pristup promenjen.
  const [reason, setReason] = useState("");
  /*
   * Promena uloge dodatno traži svež kod iz aplikacije.
   *
   * Dodela paketa i promena uloge nisu iste težine: paket širi pristup unutar
   * postojeće uloge, a uloga menja ko sme da upravlja nalozima. Zato kod stoji
   * uz obrazac za ulogu, a ne uz celu tabelu.
   */
  const [roleToken, setRoleToken] = useState("");
  const roleTokenMissing = roleToken.trim().length < 6;

  const [createState, createAction, createPending] = useActionState(
    createUserAction,
    INITIAL,
  );
  /*
   * Otvaranje naloga sa ulogom „gazda“ traži isti svež kod kao promena uloge —
   * vidi `createUserAction`. Sopstveno stanje, ne deljeno sa `roleToken`: dva
   * obrasca na istoj strani ne smeju da dele jedan uneti kod.
   */
  const [createRole, setCreateRole] = useState("komercijalista");
  const [createToken, setCreateToken] = useState("");
  const createNeedsToken = createRole === "gazda";
  const createTokenMissing = createNeedsToken && createToken.trim().length < 6;

  const state =
    toggleState.error || toggleState.ok
      ? toggleState
      : roleState.error || roleState.ok
        ? roleState
        : createState;
  const pending = togglePending || rolePending || createPending;
  const reasonMissing = reason.trim().length < 3;

  return (
    <>
    {canManage ? (
      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Novi nalog</h2>
            <p>
              Nalog dobija samo pristup svoje uloge. Paketi dozvola se dodeljuju
              posebno, u tabeli ispod.
            </p>
          </div>
        </div>
        <form action={createAction} className="portal-settings-form">
          <label>
            <span>Ime i prezime</span>
            <input name="name" minLength={2} maxLength={120} required disabled={pending} />
          </label>
          <label>
            <span>E-pošta</span>
            <input type="email" name="email" maxLength={254} required disabled={pending} />
          </label>
          <label>
            <span>Uloga</span>
            <select
              name="role"
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value)}
              disabled={pending}
            >
              {ROLES.map((role) => (
                <option value={role.key} key={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Početna lozinka</span>
            <input
              type="password"
              name="password"
              minLength={10}
              maxLength={200}
              required
              disabled={pending}
              autoComplete="new-password"
            />
            <small>Najmanje 10 znakova. Prenesite je zaposlenom lično.</small>
          </label>
          {createNeedsToken ? (
            <label>
              <span>Kod iz aplikacije (obavezno za ulogu „Vlasnik“)</span>
              <input
                name="token"
                value={createToken}
                onChange={(event) => setCreateToken(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                placeholder="šestocifreni kod"
                disabled={pending}
              />
              <small>
                Otvaranje naloga sa punim vlasničkim pristupom traži svež kod
                iz Vaše aplikacije za jednokratne kodove.
              </small>
            </label>
          ) : null}
          <button
            type="submit"
            className="portal-button"
            data-variant="primary"
            disabled={pending || createTokenMissing}
            title={
              createTokenMissing
                ? "Unesite kod iz aplikacije za ulogu „Vlasnik“"
                : "Otvorite nalog"
            }
          >
            {createPending ? "Otvaranje…" : "Otvorite nalog"}
          </button>
        </form>
      </section>
    ) : null}

    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Matrica dozvola</h2>
          <p>
            {canManage
              ? "Izmene važe odmah, bez ponovne prijave korisnika."
              : "Pregled je dostupan, ali dozvole menja isključivo Vlasnik."}
          </p>
        </div>
      </div>

      {canManage ? (
        <div className="portal-permission-reason">
          <label>
            <span>Razlog izmene (obavezno)</span>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              placeholder="npr. potreba za dubljom analizom prodaje"
            />
          </label>
          <label>
            <span>Kod iz aplikacije (samo za promenu uloge)</span>
            <input
              value={roleToken}
              onChange={(event) => setRoleToken(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="šestocifreni kod"
            />
          </label>
          {reasonMissing ? (
            <small>Unesite razlog pre nego što promenite dozvolu ili ulogu.</small>
          ) : null}
          {!reasonMissing && roleTokenMissing ? (
            <small>
              Promena uloge i izmena paketa „Korisnici i dozvole“ i „Bezbednost
              naloga“ traže i svež kod iz Vaše aplikacije za jednokratne kodove.
              Ostali paketi ga ne traže.
            </small>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p className="portal-login-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="portal-permission-ok" role="status">
          {state.ok}
        </p>
      ) : null}

      <div className="portal-table-wrap">
        <table className="portal-table portal-permission-table">
          <thead>
            <tr>
              <th scope="col">Korisnik</th>
              <th scope="col">Uloga</th>
              {PERMISSION_PACKAGES.map((item) => (
                <th scope="col" key={item.key} title={item.description}>
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <th scope="row">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                </th>
                <td>
                  {canManage ? (
                    <form action={roleAction} className="portal-inline-form">
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="reason" value={reason} />
                      <input type="hidden" name="token" value={roleToken} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={pending || reasonMissing || roleTokenMissing}
                        aria-label={`Uloga korisnika ${user.name}`}
                      >
                        {ROLES.map((role) => (
                          <option value={role.key} key={role.key}>
                            {role.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={pending || reasonMissing || roleTokenMissing}
                        title={
                          reasonMissing
                            ? "Prvo unesite razlog izmene"
                            : roleTokenMissing
                              ? "Unesite kod iz aplikacije"
                              : "Sačuvajte ulogu"
                        }
                      >
                        Sačuvajte
                      </button>
                    </form>
                  ) : (
                    ROLE_LABELS[user.role as keyof typeof ROLE_LABELS]
                  )}
                </td>
                {PERMISSION_PACKAGES.map((item) => {
                  const granted = user.permissions.includes(item.key);
                  // Poslednja zaštita od zaključavanja sistema; ista provera
                  // postoji i na serveru, gde jedina i obavezuje.
                  const selfLockout =
                    item.key === "korisnici" && user.id === actorId && granted;
                  // Sebi se paket ne dodeljuje; server odbija isto.
                  const selfGrant = user.id === actorId && !granted;
                  const needsToken = ESCALATION_PACKAGES.includes(item.key);
                  return (
                    <td key={item.key} data-granted={granted}>
                      {canManage ? (
                        <form action={toggleAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input
                            type="hidden"
                            name="permissionKey"
                            value={item.key}
                          />
                          <input
                            type="hidden"
                            name="grant"
                            value={granted ? "0" : "1"}
                          />
                          <input type="hidden" name="reason" value={reason} />
                          {needsToken ? (
                            <input type="hidden" name="token" value={roleToken} />
                          ) : null}
                          <button
                            type="submit"
                            className="portal-permission-toggle"
                            data-on={granted}
                            disabled={
                              pending ||
                              reasonMissing ||
                              selfLockout ||
                              selfGrant ||
                              (needsToken && roleTokenMissing)
                            }
                            title={
                              selfLockout
                                ? "Ne možete sebi oduzeti administraciju korisnika"
                                : selfGrant
                                  ? "Paket ne možete dodeliti sami sebi"
                                  : needsToken && roleTokenMissing
                                    ? "Unesite kod iz aplikacije"
                                    : `${granted ? "Oduzmite" : "Dodelite"}: ${item.description}`
                            }
                          >
                            {granted ? "ima" : "nema"}
                          </button>
                        </form>
                      ) : (
                        <span
                          className="portal-permission-toggle"
                          data-on={granted}
                        >
                          {granted ? "ima" : "nema"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="portal-phase-notice">
        <h3>Kako se pristup širi</h3>
        <ul>
          <li>
            Uloga „Menadžer“ ne postoji. Dublji pristup se dodeljuje paketom, a
            ne novom ulogom.
          </li>
          <li>
            Komercijalista sa paketom „Napredna analitika i izveštaji“ vidi
            analitiku cele firme, ali ne odobrava limite, ne poručuje robu, ne
            menja korisnike i ne zatvara kritična upozorenja za sve.
          </li>
          <li>
            Magacioner ne dobija finansijsku analitiku, limite ni administraciju
            korisnika.
          </li>
          <li>
            Skrivanje stavke iz navigacije je samo prikaz — svaka ruta i svaka
            radnja se nezavisno proveravaju na serveru.
          </li>
        </ul>
      </div>
    </section>
    </>
  );
}
