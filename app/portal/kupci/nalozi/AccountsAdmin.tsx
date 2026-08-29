"use client";

import { useActionState, useState } from "react";
import { Badge, Field, PortalButton } from "@/components/portal/PortalPrimitives";
import {
  issueInvitationAction,
  proposeContactAction,
  setAccountStatusAction,
  type AccountActionState,
} from "@/app/portal/kupci/nalozi/actions";
import {
  CUSTOMER_ACCOUNT_LABELS,
  CUSTOMER_ACCOUNT_TONES,
} from "@/lib/portal/status-labels";

const INITIAL: AccountActionState = { error: null, ok: null };

export type AccountRow = {
  id: string;
  customerName: string;
  email: string;
  name: string;
  status: string;
  lastLoginAt: Date | null;
  decisionReason: string | null;
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
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {canPropose ? (
        <section className="portal-panel">
          <h2>Predloži kontakt kupca</h2>
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
                {creating ? "Slanje…" : "Predloži kontakt"}
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
                      {account.lastLoginAt
                        ? new Date(account.lastLoginAt).toLocaleDateString("sr-Latn-RS")
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
                            disabled={inviting}
                          >
                            {account.status === "requested"
                              ? "Odobri i pozovi"
                              : "Izdaj nov poziv"}
                          </PortalButton>
                        </form>
                        <PortalButton
                          variant="ghost"
                          onClick={() =>
                            setOpenId(openId === account.id ? null : account.id)
                          }
                        >
                          {openId === account.id ? "Zatvori" : "Promeni stanje"}
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
                <option value="approved">Vrati u upotrebu</option>
                <option value="suspended">Isključi</option>
                <option value="rejected">Odbij</option>
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
              {changing ? "Čuvanje…" : "Sačuvaj"}
            </PortalButton>
          </form>
        ) : null}
      </section>
    </>
  );
}
