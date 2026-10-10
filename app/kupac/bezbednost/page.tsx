import { readRememberCookie } from "@/lib/auth/remember-session";
import { isRememberEnabled } from "@/lib/auth/rememberRules.mjs";
import { listRememberedDevices } from "@/lib/auth/remember-tokens";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { dmyTime } from "@/lib/ordering/panelFormat.mjs";
import { PasswordForm } from "./PasswordForm";
import { ForgetDeviceButton, LogoutAllButton } from "./SecurityActions";

export const dynamic = "force-dynamic";

/** Zapamćeni uređaji, odjava sa svih uređaja i promena lozinke — samo za sopstveni nalog. */
export default async function CustomerSecurityPage() {
  const session = await requireCustomerSession("/kupac/bezbednost");
  const devices = await listRememberedDevices(session.accountId, await readRememberCookie());
  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Bezbednost naloga</h1>
          <p className="pn-lead">Prijavljeni ste kao {session.email}. Ovde upravljate samo svojim nalogom.</p>
        </div>
      </header>
      <div className="pn-split">
        <div className="pn" style={{ alignContent: "start" }}>
          <section className="pn-card" aria-labelledby="uredjaji">
            <h2 id="uredjaji" className="pn-h2">
              Zapamćeni uređaji
            </h2>
            <p className="pn-small pn-muted">
              {isRememberEnabled()
                ? "Uređaji na kojima ste izabrali „Zapamti me“. Svaki važi najviše 30 dana od prijave lozinkom; slanje zahteva sa njih i dalje traži lozinku."
                : "„Zapamti me“ nije uključeno; sesija traje 8 sati."}
              {session.assurance === "remembered" ? " Trenutno ste prijavljeni sa zapamćenog uređaja." : ""}
            </p>
            {devices.length === 0 ? (
              <p className="pn-small">Nema zapamćenih uređaja.</p>
            ) : (
              <ul className="pn-versions">
                {devices.map((d) => (
                  <li key={d.id}>
                    <span style={{ display: "grid", gap: 2 }}>
                      <span>
                        <strong>{d.deviceLabel}</strong> {d.current ? <span className="pn-tag" data-tone="success" style={{ marginTop: 0 }}>ovaj uređaj</span> : null}
                      </span>
                      <span className="pn-small pn-muted pn-num">
                        zapamćen {dmyTime(d.createdAt)} · poslednja obnova {dmyTime(d.lastUsedAt)} · ističe {dmyTime(d.expiresAt)}
                      </span>
                    </span>
                    <ForgetDeviceButton id={d.id} label={d.deviceLabel} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="pn-card" aria-labelledby="svi-uredjaji">
            <h2 id="svi-uredjaji" className="pn-h2">
              Odjava sa svih uređaja
            </h2>
            <p className="pn-small pn-muted">Gasi sve prijave ovog naloga i sve zapamćene uređaje, uključujući ovaj. Posle toga se prijavljujete lozinkom.</p>
            <div className="pn-actions pn-actions-start">
              <LogoutAllButton />
            </div>
          </section>
        </div>
        <section className="pn-card" aria-labelledby="lozinka">
          <h2 id="lozinka" className="pn-h2">
            Promena lozinke
          </h2>
          <p className="pn-small pn-muted">Posle promene odjavljujete se sa svih uređaja i svi zapamćeni uređaji se brišu.</p>
          <PasswordForm />
        </section>
      </div>
    </div>
  );
}
