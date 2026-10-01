import { companyContact } from "@/lib/company-contact";
import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadDatasetInfo } from "@/lib/data-state/dataset";
import { loadCustomerContacts, loadCustomerOffers } from "@/lib/ordering/ordering-service";

/**
 * Ponude prijavljenog kupca za kartice kataloga i stranice proizvoda.
 *
 * Kupac isključivo iz sesije; ruta ne prima nijedan parametar. Statične strane
 * kataloga je pitaju posle učitavanja, i to samo uz marker prijave. Bez
 * kupčeve sesije (anonimno ili interni nalog) → 401 bez podataka. Lager se ne
 * vraća: izvor ne postoji, pa se ne izmišlja.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  const session = await getCustomerSession().catch(() => null);
  if (!session) return Response.json({ signedIn: false }, { status: 401, headers: NO_STORE });
  const [{ mode, offers }, contacts, dataset] = await Promise.all([
    loadCustomerOffers(session.customerId),
    loadCustomerContacts(session.customerId),
    loadDatasetInfo(),
  ]);
  return Response.json(
    {
      signedIn: true,
      company: session.customerName,
      demo: dataset.kind === "demo",
      ordering: mode.enabled
        ? { enabled: true, priceList: { name: mode.priceList.name, kind: mode.priceList.kind, currency: mode.priceList.currency } }
        : { enabled: false, reason: mode.reason },
      offers,
      contacts: { ...contacts, office: {
          phone: companyContact.phone,
          phoneHref: companyContact.phoneHref,
          email: companyContact.email,
          emailHref: companyContact.emailHref,
          workingHours: companyContact.workingHours,
        },
      },
    },
    { headers: NO_STORE },
  );
}
