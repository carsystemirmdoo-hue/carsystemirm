import { srDateTime } from "@/components/customer/account-format";
import { readRememberCookie } from "@/lib/auth/remember-session";
import { isRememberEnabled } from "@/lib/auth/rememberRules.mjs";
import { listRememberedDevices } from "@/lib/auth/remember-tokens";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { forgetDeviceAction, logoutAllDevicesAction } from "./actions";
import { PasswordForm } from "./PasswordForm";

export const dynamic = "force-dynamic";

/** Zapamćeni uređaji, odjava sa svih uređaja i promena lozinke — samo za sopstveni nalog. */
export default async function CustomerSecurityPage() {
  const session = await requireCustomerSession("/kupac/bezbednost");
  const devices = await listRememberedDevices(session.accountId, await readRememberCookie());
  return (
    <>
      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Zapamćeni uređaji</h2>
            <p>
              {isRememberEnabled()
                ? "Uređaji na kojima ste izabrali „Zapamti me”. Svaki važi najviše 30 dana od prijave lozinkom; slanje porudžbine sa njih i dalje traži lozinku."
                : "„Zapamti me” nije uključeno; sesija traje 8 sati."}
              {session.assurance === "remembered" ? " Trenutno ste prijavljeni sa zapamćenog uređaja." : ""}
            </p>
          </div>
        </div>
        <div className="portal-panel-body">
          {devices.length === 0 ? (
            <p>Nema zapamćenih uređaja.</p>
          ) : (
            <ol className="kk-requests">
              {devices.map((d) => (
                <li key={d.id}>
                  <div className="kk-request-head">
                    <strong>{d.deviceLabel}</strong>
                    {d.current ? <span className="kk-status" data-tone="success">Ovaj uređaj</span> : null}
                    <small>
                      zapamćen {srDateTime(d.createdAt)} · poslednja obnova {srDateTime(d.lastUsedAt)} · ističe {srDateTime(d.expiresAt)}
                    </small>
                  </div>
                  <form action={forgetDeviceAction.bind(null, d.id)} className="kk-inline-form">
                    <button type="submit" className="portal-button" data-variant="ghost">
                      Zaboravi ovaj uređaj
                    </button>
                  </form>
                </li>
              ))}
            </ol>
          )}
          <form action={logoutAllDevicesAction} className="kk-step">
            <h3>Odjava sa svih uređaja</h3>
            <p>Gasi sve prijave ovog naloga i sve zapamćene uređaje, uključujući ovaj. Posle toga se prijavljujete lozinkom.</p>
            <span className="kk-step-actions">
              <button type="submit" className="portal-button" data-variant="secondary">
                Odjavi me sa svih uređaja
              </button>
            </span>
          </form>
        </div>
      </section>
      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Promena lozinke</h2>
            <p>Posle promene odjavljujete se sa svih uređaja i svi zapamćeni uređaji se brišu.</p>
          </div>
        </div>
        <div className="portal-panel-body">
          <PasswordForm />
        </div>
      </section>
    </>
  );
}
