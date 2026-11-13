import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { CrumbLabel } from "@/components/portal/Breadcrumbs";
import { requireCapability } from "@/lib/authz/session";
import { buildOrderEmail, mailConfig, orderEmailRecipients, orderEmailVariants } from "@/lib/ordering/order-email";
import { loadOrderRequest } from "@/lib/ordering/ordering-service";
import { SendMailButton } from "./SendMailButton";

export const dynamic = "force-dynamic";

/**
 * Pregled maila o porudžbini (2026-11-11). Ovako bi izgledao mail koji dobijaju
 * komercijalista kupca i kancelarija; dugme šalje isti mejl odmah (proba, ponovno slanje).
 */
export default async function OrderEmailPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCapability("view:zahtevi", `/portal/zahtevi/${encodeURIComponent(id)}/mail`);
  const o = await loadOrderRequest(user, id);
  if (!o) notFound();
  const h = await headers();
  const base = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "carsystemirm.com"}`;
  const mail = buildOrderEmail(o, base, await orderEmailVariants(o).catch(() => []));
  const to = await orderEmailRecipients(o.customerId);
  const cfg = mailConfig();

  return (
    <>
      <CrumbLabel segment={o.id} label={o.orderNumber ?? o.requestNumber} />
      <CrumbLabel segment="mail" label="Pregled maila" />
      <div className="pn">
        <p className="pn-back">
          <Link href={`/portal/zahtevi/${o.id}`}>← Nazad na zahtev</Link>
        </p>
        <div className="pn-head">
          <div>
            <h1 className="pn-title">Pregled maila · {o.orderNumber ?? o.requestNumber}</h1>
            <p className="pn-lead">
              Ovako izgleda mail koji dobijaju komercijalista kupca i kancelarija kada kupac pošalje porudžbinu.{" "}
              {!cfg.configured
                ? "Slanje još nije podešeno na serveru (Gmail nalog i lozinka za aplikacije)."
                : cfg.automatic
                  ? "Šalje se automatski posle svake nove porudžbine."
                  : "Automatsko slanje je isključeno; dugme šalje ovaj mejl odmah."}
            </p>
          </div>
        </div>
        <section className="portal-panel mail-meta">
          <dl>
            <div>
              <dt>Prima</dt>
              <dd>
                {to.map((r, i) => (
                  <span key={i} className="mail-to">
                    {r.name} <small>({r.role})</small> {r.email ? <code>{r.email}</code> : <em>adresa nije podešena</em>}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>Naslov</dt>
              <dd><b>{mail.subject}</b></dd>
            </div>
          </dl>
        </section>
        <SendMailButton orderId={o.id} disabled={!cfg.configured} />
        <iframe className="mail-frame" title="Pregled maila" srcDoc={mail.html} sandbox="allow-popups allow-popups-to-escape-sandbox" />
      </div>
    </>
  );
}
