import type { Metadata } from "next";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import {
  loadConsentHistory,
  loadConsentState,
} from "@/lib/customers/consent-service";
import { CONSENT_LABELS, CONSENT_PURPOSES } from "@/lib/customers/consent.mjs";
import { ConsentControls } from "./ConsentControls";
import { dmy, dmyTime } from "@/lib/ordering/panelFormat.mjs";

export const metadata: Metadata = {
  title: "Saglasnosti · Carsystem i R-M",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  granted: "Data saglasnost",
  withdrawn: "Povučena saglasnost",
};

const SOURCE_LABEL: Record<string, string> = {
  customer_self_service: "kroz nalog",
  office_recorded_offline: "evidentirano u kancelariji",
};

/**
 * Kupčeve saglasnosti.
 *
 * Kao i `/kupac`, strana NE prima `searchParams` ni `params` — nalog dolazi
 * isključivo iz sesije.
 */
export default async function CustomerConsentsPage() {
  const session = await requireCustomerSession("/kupac/saglasnosti");

  const [state, history] = await Promise.all([
    loadConsentState(session.accountId),
    loadConsentHistory(session.accountId),
  ]);

  const rows = CONSENT_PURPOSES.map((purpose: string) => ({
    purpose,
    granted: state[purpose]?.granted ?? false,
    since: state[purpose]?.since ? dmy(new Date(state[purpose].since as string)) : null,
    textVersion: state[purpose]?.textVersion ?? null,
  }));

  return (
    <div className="pn">
      <header className="pn-head">
        <div>
          <h1 className="pn-title">Saglasnosti</h1>
          <p className="pn-lead">
            Dve odvojene odluke. Nijedna nije uslov za korišćenje naloga, i svaku možete povući jednako lako kao što ste je dali. Podrazumevano stanje je bez
            saglasnosti.
          </p>
        </div>
      </header>
      <section className="pn-card pn-form-width" style={{ maxWidth: 900 }} aria-labelledby="odluke">
        <h2 id="odluke" className="pn-h2">
          Vaše odluke
        </h2>
        <ConsentControls rows={rows} />
        <p className="pn-small pn-muted">Poruke o nalogu — poziv, promena lozinke i obaveštenja o bezbednosti — nisu marketing i stižu bez obzira na ove odluke.</p>
      </section>
      <section className="pn-card pn-card-flush" aria-labelledby="istorija-saglasnosti">
        <div className="pn-card-h">
          <h2 id="istorija-saglasnosti">Istorija</h2>
          <span className="pn-small pn-muted">Povlačenje ne briše raniji zapis; dodaje se nov događaj.</span>
        </div>
        {history.length === 0 ? (
          <p className="pn-empty pn-muted">Još nema nijedne zabeležene odluke.</p>
        ) : (
          <table className="pn-table pn-table-cards">
            <thead>
              <tr>
                <th scope="col">Kada</th>
                <th scope="col">Svrha</th>
                <th scope="col">Odluka</th>
                <th scope="col">Izvor</th>
                <th scope="col">Verzija teksta</th>
              </tr>
            </thead>
            <tbody>
              {history.map((event) => (
                <tr key={event.id}>
                  <td className="pn-c-name pn-num">{dmyTime(new Date(event.occurredAt))}</td>
                  <td data-label="Svrha">{CONSENT_LABELS[event.purpose as keyof typeof CONSENT_LABELS]?.title ?? event.purpose}</td>
                  <td data-label="Odluka">{ACTION_LABEL[event.action] ?? event.action}</td>
                  <td data-label="Izvor">{SOURCE_LABEL[event.source] ?? event.source}</td>
                  <td data-label="Verzija teksta">{event.consentTextVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
