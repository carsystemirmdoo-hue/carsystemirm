import { companyContact } from "@/lib/company-contact";
import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadCustomerContacts } from "@/lib/ordering/ordering-service";
import { loadCatalogRequestOffers } from "@/lib/ordering/request-service";
import { customerStockCaption, STALE_CAPTION } from "@/lib/stock/displayPolicy.mjs";
import { customerStockFor, loadCatalogStockItems } from "@/lib/stock/stock-import-service";

/**
 * Ponude prijavljenog kupca za kartice kataloga i stranice proizvoda.
 *
 * Kupac isključivo iz sesije; ruta ne prima nijedan parametar. Statične strane
 * kataloga je pitaju posle učitavanja, i to samo uz marker prijave. Bez
 * kupčeve sesije (anonimno ili interni nalog) → 401 bez podataka. Stanje iz
 * poslednjeg potvrđenog izvoza lagera (dok. 65 §4) ide samo kada je prikaz uključen:
 * svež snimak → tekst po artiklu (broj celih pakovanja ili „Raspoloživost na upit“),
 * zastareo → samo „potrebna je provera“; isključen → `stock: null`.
 */
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  const session = await getCustomerSession().catch(() => null);
  if (!session) return Response.json({ signedIn: false }, { status: 401, headers: NO_STORE });
  // ISTI obračun kao korpa i slanje (dok. 61 K2): osnovna cena + odobreni rabat po opciji plaćanja.
  const [catalog, contacts] = await Promise.all([loadCatalogRequestOffers(session.customerId), loadCustomerContacts(session.customerId)]);
  // Stanje ne zavisi od toga da li je kupcu uključeno poručivanje (stvarni kupci ga još nemaju).
  const stockItems = await loadCatalogStockItems();
  const stockData = await customerStockFor(stockItems.map((i) => i.articleId));
  // Samo kupac sa sesijom: datum stanja, tekst po artiklu; bez šifara, izvornih količina i tuđih podataka.
  const stock =
    stockData.state === "svez"
      ? {
          state: "svez" as const,
          ...customerStockCaption({ stockDate: stockData.stockDate }),
          items: stockItems.filter((i) => stockData.byArticle.has(i.articleId)),
          byArticle: Object.fromEntries(stockData.byArticle),
        }
      : stockData.state === "zastareo"
        ? { state: "zastareo" as const, ...STALE_CAPTION, items: stockItems, byArticle: {} }
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
