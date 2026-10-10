"use client";

import { useActionState, useState } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  issueInvitationAction,
  proposeContactAction,
  recordOfflineConsentAction,
  revokeAccessAction,
  setAccountStatusAction,
  verifyContactAction,
  type AccountActionState,
} from "@/app/portal/kupci/nalozi/actions";
import { GATE_REASONS } from "@/lib/customers/contactVerification.mjs";
import {
  CUSTOMER_ACCOUNT_LABELS,
  CUSTOMER_ACCOUNT_TONES,
} from "@/lib/portal/status-labels";
import { dmy } from "@/lib/ordering/panelFormat.mjs";

const INITIAL: AccountActionState = { error: null, ok: null };

export type AccountRow = {
  id: string;
  customerName: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: Date | null;
  decisionReason: string | null;
  /** Kapija poziva (0028) — izračunata na serveru, ovde se samo prikazuje. */
  gate: {
    allowed: boolean;
    reasons: string[];
    verification: {
      method: string;
      personRole: string;
      verifiedAt: Date;
      verifiedByName: string | null;
    } | null;
    mappedIdentifiers: { id: string; code: string; issuerCode: string; sourceName: string | null }[];
  } | null;
};

const METHOD_LABELS: Record<string, string> = {
  callback_known_number: "povratni poziv na broj poznat od ranije",
  signed_authorization: "potpisano ovlašćenje firme",
  in_person: "lično, uz potvrdu vlasnika",
};

export type CustomerOption = { id: string; label: string };

export function AccountsAdmin({
  accounts,
  customers,
  canManage,
  canPropose,
}: {
  accounts: AccountRow[];
  customers: CustomerOption[];
  canManage: boolean;
  canPropose: boolean;
}) {
  const [createState, createAction, creating] = useActionState(
    proposeContactAction,
    INITIAL,
  );
  const [inviteState, inviteAction, inviting] = useActionState(
    issueInvitationAction,
    { error: null, ok: null, link: null as string | null },
  );
  const [statusState, statusAction, changing] = useActionState(
    setAccountStatusAction,
    INITIAL,
  );
  const [consentState, consentAction, savingConsent] = useActionState(
    recordOfflineConsentAction,
    INITIAL,
  );
  const [verifyState, verifyAction, verifying] = useActionState(verifyContactAction, INITIAL);
  const [revokeState, revokeAction, revoking] = useActionState(revokeAccessAction, INITIAL);
  const [openId, setOpenId] = useState<string | null>(null);
  const [consentId, setConsentId] = useState<string | null>(null);
  const [verifyId, setVerifyId] = useState<string | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const verifyTarget = accounts.find((a) => a.id === verifyId) ?? null;

  return (
    <>
      {canPropose ? (
        <section className="portal-panel">
          <h2>Predložite kontakt kupca</h2>
          <p>
            Kupčev nalog je odvojen identitet — ne dobija nijednu internu ulogu i
            vidi isključivo podatke svoje firme.{" "}
            <strong>Lozinku ne unosite i nikada je ne saznajete</strong> —
            postavlja je kupac kroz jednokratni poziv.
          </p>
          {createState.error ? (
            <div className="portal-login-error" role="alert">
              <span>
                <strong>Nalog nije otvoren</strong>
                <small>{createState.error}</small>
              </span>
            </div>
          ) : null}
          {createState.ok ? (
            <p className="portal-login-hint" role="status">
              {createState.ok}
            </p>
          ) : null}

          {customers.length === 0 ? (
            <p>Nema nijednog kupca u bazi — nalog se ne može vezati ni za koga.</p>
          ) : (
            <form action={createAction} className="portal-form">
              <Field label="Kupac" required>
                <select name="customerId" required>
                  <option value="">— izaberite —</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="E-pošta" required>
                <input type="email" name="email" maxLength={254} required />
              </Field>
              <Field label="Ime i prezime" required>
                <input type="text" name="name" minLength={2} maxLength={120} required />
              </Field>
              <Field label="Razlog" required hint="Upisuje se u trag revizije.">
                <input type="text" name="reason" minLength={3} maxLength={500} required />
              </Field>
              <PortalButton type="submit" variant="primary" disabled={creating}>
                {creating ? "Slanje…" : "Predložite kontakt"}
              </PortalButton>
            </form>
          )}
        </section>
      ) : null}

      {canManage && inviteState.link ? (
        <section className="portal-panel" data-accent="warning">
          <h2>Link za aktivaciju — prikazuje se samo sada</h2>
          <p>{inviteState.ok}</p>
          <p>
            <code>{inviteState.link}</code>
          </p>
          <p className="portal-login-hint">
            U bazi stoji samo otisak tokena. Kada zatvorite ovaj ekran, link se
            ne može ponovo prikazati — izdaje se nov poziv.
          </p>
        </section>
      ) : null}

      <section className="portal-panel">
        <h2>Nalozi kupaca ({accounts.length})</h2>
        {inviteState.error ? (
          <div className="portal-login-error" role="alert">
            <span>
              <strong>Poziv nije izdat</strong>
              <small>{inviteState.error}</small>
            </span>
          </div>
        ) : null}
        {statusState.error ? (
          <div className="portal-login-error" role="alert">
            <span>
              <strong>Promena nije sačuvana</strong>
              <small>{statusState.error}</small>
            </span>
          </div>
        ) : null}
        {statusState.ok ? (
          <p className="portal-login-hint" role="status">
            {statusState.ok}
          </p>
        ) : null}
        {[verifyState, revokeState].map((state, i) =>
          state.error ? (
            <div className="portal-login-error" role="alert" key={`e${i}`}>
              <span>
                <strong>{i === 0 ? "Potvrda nije sačuvana" : "Opoziv nije izvršen"}</strong>
                <small>{state.error}</small>
              </span>
            </div>
          ) : state.ok ? (
            <p className="portal-login-hint" role="status" key={`o${i}`}>
              {state.ok}
            </p>
          ) : null,
        )}

        {accounts.length === 0 ? (
          <p>Nijedan kupac još nema otvoren nalog.</p>
        ) : (
          <div className="portal-table-wrap">
            <table className="portal-table">
              <thead>
                <tr>
                  <th scope="col">Kupac</th>
                  <th scope="col">Nalog</th>
                  <th scope="col">Stanje</th>
                  <th scope="col">Provera za poziv</th>
                  <th scope="col">Poslednja prijava</th>
                  {canManage ? <th scope="col">Radnja</th> : null}
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.customerName}</strong>
                    </td>
                    <td>
                      {account.name}
                      <small>{account.email}</small>
                    </td>
                    <td>
                      <Badge tone={CUSTOMER_ACCOUNT_TONES[account.status] ?? "neutral"}>
                        {CUSTOMER_ACCOUNT_LABELS[account.status] ?? account.status}
                      </Badge>
                      {account.decisionReason ? (
                        <small>{account.decisionReason}</small>
                      ) : null}
                    </td>
                    <td>
                      {account.status === "active" ? (
                        <small>Aktivan nalog</small>
                      ) : !account.gate ? (
                        "—"
                      ) : account.gate.allowed ? (
                        <Badge tone="success">Spremno za poziv</Badge>
                      ) : (
                        <ul className="portal-gate-reasons">
                          {account.gate.reasons.map((r) => (
                            <li key={r}>
                              <small>{GATE_REASONS[r as keyof typeof GATE_REASONS] ?? r}</small>
                            </li>
                          ))}
                        </ul>
                      )}
                      {account.gate?.verification ? (
                        <small>
                          Potvrđeno: {METHOD_LABELS[account.gate.verification.method] ?? account.gate.verification.method}
                          {" · "}
                          {account.gate.verification.personRole}
                          {" · "}
                          {dmy(new Date(account.gate.verification.verifiedAt))}
                          {account.gate.verification.verifiedByName
                            ? ` · ${account.gate.verification.verifiedByName}`
                            : ""}
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {account.lastLoginAt
                        ? dmy(new Date(account.lastLoginAt))
                        : "—"}
                    </td>
                    {canManage ? (
                      <td>
                        <form action={inviteAction} style={{ display: "inline" }}>
                          <input type="hidden" name="accountId" value={account.id} />
                          <input
                            type="hidden"
                            name="reason"
                            value="Izdavanje poziva kupcu"
                          />
                          <PortalButton
                            type="submit"
                            variant="ghost"
                            disabled={inviting || !account.gate?.allowed}
                            title={
                              account.gate?.allowed
                                ? undefined
                                : "Poziv se izdaje tek kada su firma i osoba potvrđene."
                            }
                          >
                            {account.status === "requested"
                              ? "Odobrite i pozovite"
                              : "Izdajte nov poziv"}
                          </PortalButton>
                        </form>
                        {(account.status === "requested" || account.status === "approved") &&
                        !account.gate?.verification ? (
                          <PortalButton
                            variant="ghost"
                            onClick={() => setVerifyId(verifyId === account.id ? null : account.id)}
                          >
                            {verifyId === account.id ? "Zatvorite" : "Potvrdite osobu"}
                          </PortalButton>
                        ) : null}
                        {account.status !== "rejected" ? (
                          <PortalButton
                            variant="ghost"
                            onClick={() => setRevokeId(revokeId === account.id ? null : account.id)}
                          >
                            {revokeId === account.id ? "Zatvorite" : "Opozovite pristup"}
                          </PortalButton>
                        ) : null}
                        <PortalButton
                          variant="ghost"
                          onClick={() =>
                            setOpenId(openId === account.id ? null : account.id)
                          }
                        >
                          {openId === account.id ? "Zatvorite" : "Promenite stanje"}
                        </PortalButton>
                        <PortalButton
                          variant="ghost"
                          onClick={() =>
                            setConsentId(
                              consentId === account.id ? null : account.id,
                            )
                          }
                        >
                          {consentId === account.id
                            ? "Zatvorite"
                            : "Evidentirajte saglasnost"}
                        </PortalButton>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canManage && openId ? (
          <form action={statusAction} className="portal-form">
            <input type="hidden" name="accountId" value={openId} />
            <Field label="Novo stanje" required>
              <select name="status" defaultValue="suspended" required>
                <option value="approved">Vratite u upotrebu</option>
                <option value="suspended">Isključite</option>
                <option value="rejected">Odbijte</option>
              </select>
            </Field>
            <Field
              label="Razlog"
              required
              hint="Obavezan. Svaka promena stanja opoziva sve sesije tog naloga."
            >
              <input type="text" name="reason" minLength={3} maxLength={500} required />
            </Field>
            <PortalButton type="submit" variant="primary" disabled={changing}>
              {changing ? "Čuvanje…" : "Sačuvajte"}
            </PortalButton>
          </form>
        ) : null}

        {canManage && verifyTarget ? (
          <form action={verifyAction} className="portal-form">
            <input type="hidden" name="accountId" value={verifyTarget.id} />
            <h3>Potvrda ovlašćene osobe — {verifyTarget.name}</h3>
            <p>
              E-pošta upisana na kartici partnera <strong>nije</strong> potvrda da ta
              osoba sme da vidi podatke firme. Potvrdite kanalom koji ne zavisi od
              same osobe: pozovite firmu na broj poznat od ranije, tražite potpisano
              ovlašćenje ili potvrdite lično uz vlasnika. Potvrda važi samo za
              adresu <strong>{verifyTarget.email}</strong>.
            </p>
            {verifyTarget.gate && verifyTarget.gate.mappedIdentifiers.length === 0 ? (
              <p className="portal-login-hint">
                Firma još nije povezana sa BizniSoft šifrom partnera — prvo je povežite
                u registru partnera.
              </p>
            ) : (
              <>
                <Field label="Firma identifikovana šifrom partnera" required>
                  <select name="basisIdentifierId" required>
                    {verifyTarget.gate?.mappedIdentifiers.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.issuerCode}/{i.code}
                        {i.sourceName ? ` · ${i.sourceName}` : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Način potvrde" required>
                  <select name="method" defaultValue="callback_known_number" required>
                    {Object.entries(METHOD_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Odakle je adresa e-pošte" required hint="Izvor adrese ne govori ništa o ovlašćenju.">
                  <select name="contactSource" defaultValue="provided_by_company" required>
                    <option value="provided_by_company">dala firma</option>
                    <option value="biznisoft_partner_record">kartica partnera u BizniSoftu</option>
                    <option value="provided_by_sales_rep">dostavio komercijalista</option>
                    <option value="public_business_listing">javno dostupan poslovni kontakt</option>
                  </select>
                </Field>
                <Field label="URL izvora" hint="Obavezno samo za javno dostupan kontakt.">
                  <input type="url" name="sourceReference" maxLength={500} />
                </Field>
                <Field label="Funkcija osobe u firmi" required>
                  <input type="text" name="personRole" minLength={2} maxLength={120} required />
                </Field>
                <Field
                  label="Beleška o dokazu"
                  required
                  hint="Ko je potvrdio, kojim kanalom i kada. Ne ulazi u trag revizije."
                >
                  <textarea name="evidenceNote" minLength={15} maxLength={1000} required rows={3} />
                </Field>
                <PortalButton type="submit" variant="primary" disabled={verifying}>
                  {verifying ? "Čuvanje…" : "Sačuvajte potvrdu"}
                </PortalButton>
              </>
            )}
          </form>
        ) : null}

        {canManage && revokeId ? (
          <form action={revokeAction} className="portal-form">
            <input type="hidden" name="accountId" value={revokeId} />
            <h3>Opoziv pristupa</h3>
            <p>
              Poništava potvrdu osobe i sve otvorene pozive, isključuje nalog i
              prekida sve njegove sesije. Za promenu kontakt osobe: opozovite
              staru osobu, pa predložite, potvrdite i pozovite novu.
            </p>
            <Field label="Razlog" required hint="Upisuje se u trag revizije.">
              <input type="text" name="reason" minLength={3} maxLength={500} required />
            </Field>
            <PortalButton type="submit" variant="primary" disabled={revoking}>
              {revoking ? "Opoziv…" : "Opozovite pristup"}
            </PortalButton>
          </form>
        ) : null}

        {canManage && consentId ? (
          <form action={consentAction} className="portal-form">
            <input type="hidden" name="accountId" value={consentId} />
            <h3>Odluka doneta van sistema</h3>
            <p>
              Zapisujete <strong>kupčevu</strong> odluku, ne svoju. Zapis nosi
              Vaš potpis i referencu na zahtev. Ovo ne utiče na nalog, cene,
              dokumente ni prijavu.
            </p>
            {consentState.error ? (
              <div className="portal-login-error" role="alert">
                <span>
                  <strong>Nije evidentirano</strong>
                  <small>{consentState.error}</small>
                </span>
              </div>
            ) : null}
            {consentState.ok ? (
              <p className="portal-login-hint" role="status">
                {consentState.ok}
              </p>
            ) : null}
            <Field label="Svrha" required>
              <select name="purpose" defaultValue="email_marketing" required>
                <option value="email_marketing">Obaveštenja e-poštom</option>
                <option value="ad_personalization">Prilagođavanje oglasa</option>
              </select>
            </Field>
            <Field label="Odluka kupca" required>
              {/*
                * Povlačenje je podrazumevano: to je odluka koja najčešće stiže
                * van sistema — telefonom ili pisanim zahtevom.
                */}
              <select name="action" defaultValue="withdrawn" required>
                <option value="withdrawn">Povukao saglasnost</option>
                <option value="granted">Dao saglasnost</option>
              </select>
            </Field>
            <Field
              label="Referenca na zahtev"
              required
              hint={'Kratka referenca, npr. „telefonski zahtev 12.09." — NE prepisujte sadržaj poruke.'}
            >
              <input
                type="text"
                name="requestReference"
                minLength={3}
                maxLength={300}
                required
              />
            </Field>
            <PortalButton type="submit" variant="primary" disabled={savingConsent}>
              {savingConsent ? "Čuvanje…" : "Evidentirajte"}
            </PortalButton>
          </form>
        ) : null}
      </section>
    </>
  );
}
