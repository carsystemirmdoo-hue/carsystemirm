import { getCustomerSession } from "@/lib/authz/customer-session";
import { loadCartQuote } from "@/lib/ordering/ordering-service";
import { loadRequestQuote } from "@/lib/ordering/request-service";
import { orderingEnabledFor } from "@/lib/ordering/trial";
import type { CustomerCartPreview } from "@/lib/cart/customer-cart";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store, private", Vary: "Cookie" };

export async function GET() {
  try {
    const session = await getCustomerSession();
    if (!session) return Response.json({ error: "Prijavite se da biste videli korpu." }, { status: 401, headers });
    // Identitet firme dolazi samo iz sesije, nikad iz URL-a ili tela zahteva.
    let body: CustomerCartPreview;
    if (await orderingEnabledFor(session.customerId)) {
      const q = await loadRequestQuote(session.customerId, null);
      body = {
        mode: "request",
        label: q.options.find((o) => o.code === q.selected)?.label ?? "Plaćanje po dogovoru",
        totals: q.totals,
        incomplete: q.onRequest > 0 || q.lines.some((l) => !l.amounts),
        lines: q.lines.map((l) => {
          const p = l.byOption[q.selected ?? "osnovni"];
          return {
            id: l.articleId, code: l.articleCode, name: l.articleName,
            quantity: l.quantity, unit: l.unit,
            listPrice: p?.status === "cena" ? p.listPrice : null,
            discount: p?.status === "cena" ? p.discountPercent : null,
            price: p?.status === "cena" ? p.netPrice : null,
            total: l.amounts?.gross ?? null,
            problem: l.problem || l.quantityProblem,
          };
        }),
      };
    } else {
      const q = await loadCartQuote(session.customerId);
      body = {
        mode: "legacy", label: q.mode.priceList?.kind === "demo" ? "DEMO cene za proveru" : "Vaši odobreni uslovi",
        totals: q.totals, incomplete: q.lines.some((l) => !l.amounts),
        lines: q.lines.map((l) => ({
          id: l.articleId, code: l.articleCode, name: l.catalog?.name ?? l.articleName,
          quantity: l.quantity, unit: l.price?.unit ?? "kom",
          listPrice: l.price?.listPrice ?? null, discount: l.price?.discountPercent ?? null,
          price: l.price?.netPrice ?? null, total: l.amounts?.gross ?? null,
          problem: l.problem?.message || l.quantityProblem,
        })),
      };
    }
    return Response.json(body, { headers });
  } catch {
    return Response.json({ error: "Korpa trenutno nije dostupna." }, { status: 503, headers });
  }
}
