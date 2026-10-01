"use client";

import { useActionState, useCallback, useId, useState } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { PortalButton } from "@/components/portal/PortalPrimitives";
import { useEphemeralReveal } from "@/components/portal/useEphemeralReveal";
import {
  issueEnrollmentGrantAction,
  issueResetCodeAction,
  resetUserMfaAction,
  setAccountActiveAction,
} from "./actions";
import { EMPTY_SECURITY_ADMIN, type IssuedSecret } from "./types";

export type AccountRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  active: boolean;
  mfaEnabled: boolean;
  hasOpenReset: boolean;
};

/**
 * Bezbednosne radnje nad tuđim nalozima.
 *
 * Ekran je namerno „jedan nalog u jednom trenutku": administrator prvo bira
 * osobu, pa tek onda vidi radnje. Mreža dugmadi preko celog spiska je poziv na
 * pogrešan klik, a ove radnje se ne opozivaju.
 *
 * Svaka radnja traži razlog i svež kod iz aplikacije. Kod se ne pamti između
 * radnji — jedan unos, jedna radnja.
 */
export function SecurityAdmin({ accounts }: { accounts: AccountRow[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = accounts.find((account) => account.id === selectedId) ?? null;

  return (
    <>
      <section className="portal-panel">
        <h2>Izaberite nalog</h2>
        <p>
          Radnje na ovoj strani se ne mogu opozvati. Sopstveni nalog se ovde ne
          prikazuje — za svoju lozinku i svoj drugi faktor postoje zasebni ekrani.
        </p>

        <ul className="portal-account-list">
          {accounts.map((account) => (
            <li key={account.id}>
              <button
                type="button"
                onClick={() =>
                  setSelectedId(account.id === selectedId ? null : account.id)
                }
                aria-pressed={account.id === selectedId}
                className="portal-account-row"
              >
                <span className="portal-account-name">{account.name}</span>
                <span className="portal-account-email">{account.email}</span>
                <span className="portal-account-meta">
                  {account.roleLabel}
                  {account.active ? "" : " · isključen"}
                  {account.mfaEnabled ? " · MFA" : " · bez MFA"}
                  {account.hasOpenReset ? " · kod u opticaju" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {accounts.length === 0 ? (
          <p className="portal-mfa-note">Nema drugih naloga.</p>
        ) : null}
      </section>

      {selected ? <AccountActions account={selected} /> : null}
    </>
  );
}

/** Radnje nad izabranim nalogom. */
function AccountActions({ account }: { account: AccountRow }) {
  return (
    <section className="portal-panel" aria-live="polite">
      <h2>{account.name}</h2>
      <p className="portal-mfa-note">{account.email}</p>

      <ActionForm
        action={issueResetCodeAction}
        account={account}
        title="Kod za promenu lozinke"
        description="Zaposleni sam postavlja novu lozinku na strani za oporavak. Vi novu lozinku ne saznajete. Izdavanje odmah gasi sve njegove otvorene prijave."
        submitLabel="Izdajte kod"
        busyLabel="Izdavanje…"
      />

      {account.mfaEnabled ? (
        <ActionForm
          action={resetUserMfaAction}
          account={account}
          title="Poništavanje drugog faktora"
          description="Za izgubljen ili zamenjen telefon. Briše tajnu, rezervne kodove i sve otvorene dozvole, pa odmah izdaje novu dozvolu za vezivanje."
          submitLabel="Poništite faktor"
          busyLabel="Poništavanje…"
          destructive
        />
      ) : (
        <ActionForm
          action={issueEnrollmentGrantAction}
          account={account}
          title="Dozvola za vezivanje drugog faktora"
          description="Za nalog koji još nema drugi faktor. Kod važi 30 minuta i koristi se jednom."
          submitLabel="Izdajte dozvolu"
          busyLabel="Izdavanje…"
        />
      )}

      <ActionForm
        action={setAccountActiveAction}
        account={account}
        title={account.active ? "Isključivanje naloga" : "Vraćanje naloga u rad"}
        description={
          account.active
            ? "Nalog prestaje da radi odmah, a sve otvorene prijave se gase. Podaci i trag revizije ostaju."
            : "Nalog ponovo može da se prijavi. Ranije izdati tokeni se ne oživljavaju."
        }
        submitLabel={account.active ? "Isključite nalog" : "Vratite u rad"}
        busyLabel="Izvršavanje…"
        destructive={account.active}
        extra={<input type="hidden" name="active" value={account.active ? "0" : "1"} />}
      />
    </section>
  );
}

type ActionFn = (
  previous: typeof EMPTY_SECURITY_ADMIN,
  formData: FormData,
) => Promise<typeof EMPTY_SECURITY_ADMIN>;

/**
 * Jedan obrazac za jednu radnju.
 *
 * Svi dele isti oblik — razlog, kod, dugme — jer su i zahtevi isti. Razlike u
 * izgledu među radnjama iste težine samo otežavaju čitanje.
 */
function ActionForm({
  action,
  account,
  title,
  description,
  submitLabel,
  busyLabel,
  destructive = false,
  extra,
}: {
  action: ActionFn;
  account: AccountRow;
  title: string;
  description: string;
  submitLabel: string;
  busyLabel: string;
  destructive?: boolean;
  extra?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_SECURITY_ADMIN);
  const reasonId = useId();
  const tokenId = useId();

  return (
    <details className="portal-security-action" data-destructive={destructive}>
      <summary>{title}</summary>
      <p>{description}</p>

      {state.issued ? (
        <IssuedCode issued={state.issued} />
      ) : (
        <form action={formAction}>
          <input type="hidden" name="userId" value={account.id} />
          {extra}

          <label htmlFor={reasonId}>Razlog</label>
          <input
            id={reasonId}
            name="reason"
            required
            minLength={3}
            maxLength={500}
            autoComplete="off"
            aria-describedby={`${reasonId}-hint`}
          />
          <small id={`${reasonId}-hint`}>
            Ulazi u trag revizije. Napišite šta se stvarno dogodilo.
          </small>

          <label htmlFor={tokenId}>Vaš kod iz aplikacije</label>
          <input
            id={tokenId}
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            aria-invalid={Boolean(state.error)}
          />

          {state.error ? (
            <p role="alert" className="portal-form-error">
              <PortalIcon name="warning" /> {state.error}
            </p>
          ) : null}
          {state.ok ? (
            <p role="status" className="portal-form-ok">
              {state.ok}
            </p>
          ) : null}

          <PortalButton type="submit" disabled={pending}>
            {pending ? busyLabel : submitLabel}
          </PortalButton>
        </form>
      )}
    </details>
  );
}

/**
 * Prikaz izdatog koda — jedini put kada postoji u čitljivom obliku.
 *
 * Kod nestaje čim strana ode sa ekrana. Bez toga bi „Nazad" iz back/forward
 * keša vratio živu stranu sa kodom u React stanju, moguće pred nekim drugim.
 */
function IssuedCode({ issued }: { issued: IssuedSecret }) {
  const [cleared, setCleared] = useState(false);
  const [copied, setCopied] = useState(false);
  const clear = useCallback(() => setCleared(true), []);
  useEphemeralReveal(clear, !cleared);

  if (cleared) {
    return (
      <p className="portal-mfa-note">
        Kod je uklonjen sa ekrana. Ako nije predat, izdajte nov.
      </p>
    );
  }

  const until = new Date(issued.expiresAt).toLocaleTimeString("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="portal-issued-code" data-issued-code>
      <p>
        {issued.kind === "reset"
          ? "Predajte ovaj kod lično ili telefonom. Sa njim korisnik sam postavlja novu lozinku na strani za oporavak."
          : "Predajte ovaj kod lično ili telefonom. Sa njim korisnik veže aplikaciju za jednokratne kodove."}
      </p>
      <p className="portal-mfa-note">
        Za: <strong>{issued.targetEmail}</strong> · važi do {until}
      </p>

      <code>{issued.code}</code>

      <div className="portal-recovery-actions">
        <PortalButton
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(issued.code);
            setCopied(true);
          }}
        >
          {copied ? "Kopirano" : "Kopirajte"}
        </PortalButton>
        <PortalButton type="button" onClick={clear}>
          Uklonite sa ekrana
        </PortalButton>
      </div>

      <p className="portal-mfa-note">
        Ne šaljite ga e-poštom ni porukom — kopija bi ostala kod primaoca i na
        tuđem serveru.
      </p>
    </div>
  );
}
