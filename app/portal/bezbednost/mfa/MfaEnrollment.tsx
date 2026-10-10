"use client";

import { useActionState, useCallback, useId, useState } from "react";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { PortalButton } from "@/components/portal/PortalPrimitives";
import { useEphemeralReveal } from "@/components/portal/useEphemeralReveal";
import {
  confirmEnrollmentAction,
  regenerateRecoveryAction,
  startEnrollmentAction,
} from "./actions";
import { EMPTY_ENROLLMENT } from "./types";

/**
 * Vezivanje drugog faktora.
 *
 * Deset stanja iz ugovora svedeno na tri ekrana koja korisnik zaista prolazi:
 * traženje podataka → prikaz ključa i unos prvog koda → rezervni kodovi.
 *
 * Rezervni kodovi i ključ postoje **isključivo u stanju komponente**, i to samo
 * dok traje ovaj prolaz. Nigde se ne upisuju: ni u `localStorage`, ni u adresu,
 * ni u naslov strane. Osvežavanje ih briše — i to je namerno, jer je jedina
 * garancija „vidi se jednom" ta da ne postoje nigde odakle bi se vratili.
 */
export function MfaEnrollment({
  accountEmail,
  mfaEnabled,
  needsGrant,
  onSignOut,
}: {
  accountEmail: string;
  mfaEnabled: boolean;
  needsGrant: boolean;
  onSignOut: () => Promise<void>;
}) {
  const [start, startForm, starting] = useActionState(
    startEnrollmentAction,
    EMPTY_ENROLLMENT,
  );
  const [confirm, confirmForm, confirming] = useActionState(
    confirmEnrollmentAction,
    EMPTY_ENROLLMENT,
  );
  const [regen, regenForm, regenerating] = useActionState(
    regenerateRecoveryAction,
    EMPTY_ENROLLMENT,
  );

  const [saved, setSaved] = useState(false);
  const passwordId = useId();
  const grantId = useId();
  const tokenId = useId();
  const errorId = useId();

  // Kodovi mogu doći iz aktivacije ili iz ponovnog izdavanja — isti prikaz.
  const freshCodes = confirm.recoveryCodes ?? regen.recoveryCodes;
  const freshSetup = start.setup;

  /*
   * Sklanjanje tajni kada strana ode sa ekrana.
   *
   * `no-store` sprečava keširanje odgovora, ali ne i „back/forward cache": tamo
   * pretraživač čuva celu živu stranu, sa React stanjem i svim u njemu, pa bi
   * „Nazad" vratio ključ i rezervne kodove na ekran — moguće pred nekim drugim.
   *
   * Zastavica se poništava pri svakom novom slanju obrasca, jer tada stiže nov
   * materijal koji treba prikazati.
   */
  const [hidden, setHidden] = useState(false);
  const hide = useCallback(() => setHidden(true), []);
  useEphemeralReveal(hide, Boolean(freshCodes || freshSetup));
  const reveal = useCallback(() => setHidden(false), []);

  const codes = hidden ? null : freshCodes;
  const setup = hidden ? null : freshSetup;

  if (hidden && (freshCodes || freshSetup)) {
    return (
      <section className="portal-panel">
        <h2>Prikaz je uklonjen</h2>
        <p>
          {freshCodes
            ? "Rezervni kodovi su sklonjeni sa ekrana jer je strana napuštena. Ako ih niste sačuvali, izdajte nov set."
            : "Ključ je sklonjen sa ekrana jer je strana napuštena. Pokrenite vezivanje ponovo."}
        </p>
        <form action={onSignOut}>
          <PortalButton type="submit">Odjava</PortalButton>
        </form>
      </section>
    );
  }

  if (codes) {
    return (
      <RecoveryCodes
        codes={codes}
        saved={saved}
        onSaved={() => setSaved(true)}
        onSignOut={onSignOut}
        afterActivation={Boolean(confirm.recoveryCodes)}
      />
    );
  }

  if (setup) {
    return (
      <section className="portal-panel">
        <h2>Unesite prvi kod iz aplikacije</h2>
        <p>
          Otvorite aplikaciju za jednokratne kodove (Google Authenticator, Aegis,
          1Password i slične) i dodajte nalog ručnim unosom ključa.
        </p>

        <dl className="portal-mfa-key">
          <dt>Nalog</dt>
          <dd>{accountEmail}</dd>
          <dt>Ključ</dt>
          {/* Jedini prikaz ključa. Ne generiše se QR — to bi značilo da tajna
              napusti sistem kroz treću stranu. */}
          <dd>
            <code data-mfa-secret>{setup.base32}</code>
          </dd>
          <dt>Puna adresa</dt>
          <dd>
            <code data-mfa-uri>{setup.uri}</code>
          </dd>
        </dl>

        <p className="portal-mfa-note">
          Ključ se prikazuje samo sada. Ako zatvorite stranicu pre potvrde,
          pokrenite vezivanje ponovo.
        </p>

        <form action={confirmForm} onSubmit={reveal}>
          <label htmlFor={tokenId}>Šestocifreni kod</label>
          <input
            id={tokenId}
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            required
            aria-invalid={Boolean(confirm.error)}
            aria-describedby={confirm.error ? errorId : undefined}
          />
          {confirm.error ? (
            <p id={errorId} role="alert" className="portal-form-error">
              <PortalIcon name="warning" /> {confirm.error}
            </p>
          ) : null}
          <PortalButton type="submit" variant="primary" disabled={confirming}>
            {confirming ? "Provera…" : "Aktivirajte drugi faktor"}
          </PortalButton>
        </form>
      </section>
    );
  }

  return (
    <section className="portal-panel">
      <h2>{mfaEnabled ? "Promena uređaja" : "Uključivanje drugog faktora"}</h2>
      <p>
        {mfaEnabled
          ? "Vezivanje nove aplikacije poništava prethodnu. Stari kodovi prestaju da važe."
          : "Posle uključivanja, prijava traži i kod iz aplikacije pored lozinke."}
      </p>

      <form action={startForm} onSubmit={reveal}>
        <label htmlFor={passwordId}>Trenutna lozinka</label>
        <input
          id={passwordId}
          type="password"
          name="password"
          autoComplete="current-password"
          required
          maxLength={200}
          aria-invalid={Boolean(start.error)}
        />

        {needsGrant ? (
          <>
            <label htmlFor={grantId}>Dozvola za vezivanje</label>
            <input
              id={grantId}
              name="grant"
              autoComplete="off"
              required
              maxLength={64}
              aria-invalid={Boolean(start.error)}
              aria-describedby={`${grantId}-hint`}
            />
            <small id={`${grantId}-hint`}>
              Kod koji Vam je dao vlasnik. Važi 30 minuta i koristi se jednom.
            </small>
          </>
        ) : null}

        {start.error ? (
          <p role="alert" className="portal-form-error">
            <PortalIcon name="warning" /> {start.error}
          </p>
        ) : null}

        <PortalButton type="submit" variant="primary" disabled={starting}>
          {starting ? "Priprema…" : "Nastavite"}
        </PortalButton>
      </form>

      {mfaEnabled ? (
        <details className="portal-mfa-regen">
          <summary>Nov set rezervnih kodova</summary>
          <p>Prethodni set prestaje da važi čim izdate nov.</p>
          <form action={regenForm} onSubmit={reveal}>
            <label htmlFor={`${passwordId}-r`}>Trenutna lozinka</label>
            <input
              id={`${passwordId}-r`}
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
            <label htmlFor={`${tokenId}-r`}>Kod iz aplikacije</label>
            <input
              id={`${tokenId}-r`}
              name="token"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              required
            />
            {regen.error ? (
              <p role="alert" className="portal-form-error">
                <PortalIcon name="warning" /> {regen.error}
              </p>
            ) : null}
            <PortalButton type="submit" variant="primary" disabled={regenerating}>
              {regenerating ? "Izdavanje…" : "Izdajte nove kodove"}
            </PortalButton>
          </form>
        </details>
      ) : null}
    </section>
  );
}

/**
 * Prikaz rezervnih kodova — jedini put kada postoje u čitljivom obliku.
 *
 * Preuzimanje se pravi u pretraživaču (`Blob`), ne sa servera: adresa sa
 * sadržajem kodova završila bi u istoriji, u kešu i u logu posrednika.
 */
function RecoveryCodes({
  codes,
  saved,
  onSaved,
  onSignOut,
  afterActivation,
}: {
  codes: string[];
  saved: boolean;
  onSaved: () => void;
  onSignOut: () => Promise<void>;
  afterActivation: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const text = [
    "Carsystem i R-M — rezervni kodovi za prijavu",
    "",
    "Svaki kod važi jednom. Čuvajte ih odvojeno od lozinke.",
    "",
    ...codes,
    "",
  ].join("\n");

  return (
    <section className="portal-panel" data-recovery-codes>
      <h2>Sačuvajte rezervne kodove</h2>
      <p>
        Ovo je jedini put kada se prikazuju. Svaki kod važi <strong>jednom</strong> i
        zamenjuje aplikaciju ako izgubite telefon.
      </p>

      <ol className="portal-recovery-list">
        {codes.map((code) => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ol>

      <div className="portal-recovery-actions">
        <PortalButton
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          }}
        >
          {copied ? "Kopirano" : "Kopirajte"}
        </PortalButton>

        <PortalButton
          type="button"
          onClick={() => {
            // Fajl nastaje ovde, u pretraživaču. Server nikad ne servira kodove
            // na adresi koja bi mogla da se keširа ili podeli.
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "carsystem-rezervni-kodovi.txt";
            link.click();
            URL.revokeObjectURL(url);
          }}
        >
          Preuzmite kao .txt
        </PortalButton>
      </div>

      <label className="portal-recovery-confirm">
        <input type="checkbox" checked={saved} onChange={onSaved} />
        <span>Sačuvao sam rezervne kodove</span>
      </label>

      {saved ? (
        <form action={onSignOut}>
          <p>
            {afterActivation
              ? "Drugi faktor je aktiviran. Prijavite se ponovo — sada uz kod iz aplikacije."
              : "Prijavite se ponovo da nastavite rad."}
          </p>
          <PortalButton type="submit">Odjava i ponovna prijava</PortalButton>
        </form>
      ) : (
        <p className="portal-mfa-note">
          Potvrdite da ste ih sačuvali da biste nastavili.
        </p>
      )}
    </section>
  );
}
