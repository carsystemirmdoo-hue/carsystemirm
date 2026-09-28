import type { Metadata } from "next";
import Link from "next/link";
import {
  PageHeader,
  Panel,
  SectionHeader,
} from "@/components/portal/PortalPrimitives";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import {
  loadConsentHistory,
  loadConsentState,
} from "@/lib/customers/consent-service";
import { CONSENT_PURPOSES } from "@/lib/customers/consent.mjs";
import { ConsentControls } from "./ConsentControls";
import "../../portal/portal.css";

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
  const session = await requireCustomerSession();

  const [state, history] = await Promise.all([
    loadConsentState(session.accountId),
    loadConsentHistory(session.accountId),
  ]);

  const rows = CONSENT_PURPOSES.map((purpose: string) => ({
    purpose,
    granted: state[purpose]?.granted ?? false,
    since: state[purpose]?.since
      ? new Date(state[purpose].since as string).toLocaleDateString("sr-Latn-RS")
      : null,
    textVersion: state[purpose]?.textVersion ?? null,
  }));

  return (
    <div className="portal-root portal-customer-area">
    <main className="portal-main">
      <PageHeader
        eyebrow="Moj nalog"
        title="Saglasnosti"
        description="Dve odvojene odluke. Nijedna nije uslov za korišćenje naloga, i svaku možete povući jednako lako kao što ste je dali."
      />

      <Panel>
        <SectionHeader
          title="Vaše odluke"
          description="Podrazumevano stanje je bez saglasnosti."
        />
        <div className="portal-panel-body">
        <ConsentControls rows={rows} />
        <p className="portal-login-hint">
          Poruke o nalogu — poziv, promena lozinke i obaveštenja o bezbednosti —
          nisu marketing i stižu bez obzira na ove odluke.
        </p>
        </div>
      </Panel>

      <Panel>
        <SectionHeader
          title="Istorija"
          description="Povlačenje ne briše raniji zapis; dodaje se nov događaj."
        />
        <div className="portal-panel-body">
        {history.length === 0 ? (
          <p>Još nema nijedne zabeležene odluke.</p>
        ) : (
          <table className="portal-table">
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
                  <td>
                    {new Date(event.occurredAt).toLocaleString("sr-Latn-RS")}
                  </td>
                  <td>{event.purpose}</td>
                  <td>{ACTION_LABEL[event.action] ?? event.action}</td>
                  <td>{SOURCE_LABEL[event.source] ?? event.source}</td>
                  <td>{event.consentTextVersion}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </Panel>

      <p>
        <Link href="/kupac">Nazad na nalog</Link>
      </p>
    </main>
    </div>
  );
}
