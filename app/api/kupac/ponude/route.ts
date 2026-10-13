import { companyContact } from "@/lib/company-contact";
import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadCustomerContacts } from "@/lib/ordering/ordering-service";
import { loadCatalogRequestOffers } from "@/lib/ordering/request-service";
import { customerStockCaption, customerStockLine } from "@/lib/stock/displayPolicy.mjs";
import { customerStockFor } from "@/lib/stock/stock-import-service";

/**
 * Ponude prijavljenog kupca za kartice kataloga i stranice proizvoda.
 *
 * Kupac isključivo iz sesije; ruta ne prima nijedan parametar. Statične strane
 * kataloga je pitaju posle učitavanja, i to samo uz marker prijave. Bez
 * kupčeve sesije (anonimno ili interni nalog) → 401 bez podataka. Stanje iz
 * poslednjeg izvoza lagera (dok. 65) ide samo kada je prikaz izričito uključen;
 * inače `stock: null` — bez upita nad tabelama lagera.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  const session = await getCustomerSession().catch(() => null);
  if (!session) return Response.json({ signedIn: false }, { status: 401, headers: NO_STORE });
  // ISTI obračun kao korpa i slanje (dok. 61 K2): osnovna cena + odobreni rabat po opciji plaćanja.
  const [catalog, contacts] = await Promise.all([loadCatalogRequestOffers(session.customerId), loadCustomerContacts(session.customerId)]);
  const stockData = await customerStockFor(catalog.offers.map((o) => o.articleId));
  const stock = stockData.snapshot?.stockDate && stockData.snapshot.confirmedAt
    ? {
        ...customerStockCaption({ stockDate: stockData.snapshot.stockDate, confirmedAt: stockData.snapshot.confirmedAt }),
        byArticle: Object.fromEntries(
          [...stockData.byArticle].flatMap(([id, v]) => {
            const line = customerStockLine(v.packs === null ? { status: "nema_broja", reason: v.reason ?? "" } : { status: "ok", packs: v.packs }, v.label);
            return line ? [[id, line]] : [];
          }),
        ),
      }
    : null;
  return Response.json(
    {
      signedIn: true,
      company: session.customerName,
      ordering: catalog.enabled ? { enabled: true } : { enabled: false, reason: catalog.reason },
      options: catalog.options,
      offers: catalog.offers,
      stock,
      contacts: {
        ...contacts,
        office: {
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
