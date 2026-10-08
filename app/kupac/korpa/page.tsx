import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireCustomerSession } from "@/lib/authz/customer-session";
import { loadCartQuote } from "@/lib/ordering/ordering-service";
import { CartForm, type CartView } from "./CartForm";

export const dynamic = "force-dynamic";

/*
 * Korpa FIRME iz sesije. Cene se računaju ovde, na serveru, iz aktivnog
 * cenovnika; pregledač dobija samo prikaz i otisak ponude. Ključ slanja se
 * pravi pri svakom prikazu, pa ponovljen klik na isto dugme ne pravi drugi zahtev.
 */
export default async function CustomerCartPage() {
  const session = await requireCustomerSession("/kupac/korpa");
  const quote = await loadCartQuote(session.customerId);
  const list = quote.mode.priceList;

  const view: CartView = {
    correcting: quote.correcting && !quote.correcting.replacedBy ? quote.correcting : null,
    idempotencyKey: randomUUID(),
    fingerprint: quote.fingerprint,
    canSubmit: quote.canSubmit,
    blockers: quote.blockers,
    currency: list?.currency ?? "RSD",
    totals: quote.totals,
    lines: quote.lines.map((l) => ({
      articleId: l.articleId,
      articleCode: l.articleCode,
      articleName: l.articleName,
      name: l.catalog?.name ?? l.articleName,
      href: l.catalog?.href ?? null,
      image: l.catalog?.image ?? null,
      variantLabel: l.catalog?.variantLabel ?? null,
      quantity: l.quantity,
      unit: l.price?.unit ?? null,
      packLabel: l.price?.packLabel ?? null,
      listPrice: l.price?.listPrice ?? null,
      discountPercent: l.price?.discountPercent ?? 0,
      netPrice: l.price?.netPrice ?? null,
      vatPercent: l.price?.vatPercent ?? null,
      amounts: l.amounts,
      problem: l.problem && l.problem.code !== "ordering_off" ? l.problem.message : null,
      quantityProblem: l.quantityProblem,
      step: l.price?.quantityStep ?? 1,
    })),
  };

  return (
    <section className="portal-panel">
      <div className="portal-section-header">
        <div>
          <h2>Korpa</h2>
          <p>
            Korpa pripada firmi {session.customerName}. Slanjem nastaje <strong>zahtev</strong> — porudžbina je tek
            kada ga kancelarija potvrdi.
          </p>
        </div>
        <Link href="/katalog" className="portal-section-link">← Katalog</Link>
      </div>

      {list && quote.mode.enabled ? (
        <div className="kk-pricelist" data-kind={list.kind}>
          <strong>{list.kind === "demo" ? "DEMO cenovnik" : "Cenovnik"}: {list.name}</strong>
          <span>
            {list.kind === "demo"
              ? "Izmišljene cene samo za proveru toka. Nisu važeće cene i ne idu u BizniSoft."
              : list.sourceNote}
          </span>
        </div>
      ) : (
        <div className="kk-pricelist" data-kind="off">
          <strong>Poručivanje nije uključeno</strong>
          <span>{quote.mode.enabled ? "" : quote.mode.reason} Porudžbine i dalje šaljete svom komercijalisti.</span>
        </div>
      )}

      {view.lines.length === 0 ? (
        <div className="portal-panel-body ka-empty">
          <p>
            <strong>Korpa je prazna.</strong> Artikle dodajete iz kataloga, u odeljku „Poručite ponovo”.
          </p>
          <p>
            <Link href="/katalog">Otvorite katalog →</Link> · <Link href="/kupac/porudzbine">Poslati zahtevi →</Link>
          </p>
        </div>
      ) : (
        <CartForm view={view} />
      )}
    </section>
  );
}
