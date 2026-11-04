import Link from "next/link";
import { requireCapability } from "@/lib/authz/session";
import { listMyNotices } from "@/lib/pricing/customer-rebate-service";
import { NOTICE_RETENTION_DAYS } from "@/lib/pricing/rebateSheet.mjs";
import { markNoticeAction } from "../kupci/actions";
import "../kupci/cene-kupca.css";

export const metadata = { title: "Obaveštenja o rabatima" };
export const dynamic = "force-dynamic";

/**
 * Interna obaveštenja o izmeni rabata: gazda vidi izmene komercijalista, komercijalista izmene gazde za
 * svoje kupce. Kupac ih nikad ne dobija. Brišu se posle 10 dana; pravila cena ostaju.
 */
export default async function RebateNoticesPage() {
  const user = await requireCapability("rebates:edit", "/portal/cene/obavestenja");
  const notices = await listMyNotices(user);
  const lead = user.role === "gazda" ? "Izmene rabata koje su sačuvali komercijalisti." : "Izmene rabata koje je vlasnik sačuvao za Vaše kupce.";

  return (
    <div className="pn">
      <div className="pn-head">
        <div>
          <h1 className="pn-title">Obaveštenja o rabatima</h1>
          <p className="pn-lead">
            {lead} Interna obaveštenja — kupci ih ne dobijaju. Briše se {NOTICE_RETENTION_DAYS} dana od nastanka; brisanje ne menja rabate, zakazane akcije ni rabat koji se vraća
            posle akcije.
          </p>
        </div>
        <div className="pn-head-actions"><Link href="/portal/cene/kupci" className="pn-btn">Cene po kupcu</Link></div>
      </div>
      {notices.length === 0 ? <p className="pn-empty">Nema obaveštenja u poslednjih {NOTICE_RETENTION_DAYS} dana.</p> : null}
      {notices.map((n) => (
        <section key={n.id} className="ck-notice" data-unread={n.read ? undefined : "true"} aria-label={`Obaveštenje: ${n.customer}`}>
          <div className="ck-notice-h">
            <span className="ck-badge" data-read={n.read ? "true" : undefined}>{n.read ? "Pročitano" : "Novo"}</span>
            <b><Link href={`/portal/cene/kupci/${n.customerId}`} className="pn-plain-link" style={{ color: "inherit" }}>{n.customer}</Link></b>
            <span className="pn-muted">{n.actor} je promenio rabate · <span className="pn-num">{n.createdAt}</span> · {n.period}</span>
            <span className="ck-right">
              <span className="pn-small pn-muted">briše se {n.expires}</span>
              <form action={markNoticeAction}>
                <input type="hidden" name="id" value={n.id} />
                <input type="hidden" name="procitano" value={n.read ? "ne" : "da"} />
                <button type="submit" className="pn-btn" data-size="sm">{n.read ? "Označite kao novo" : "Označite pročitano"}</button>
              </form>
            </span>
          </div>
          <table className="pn-table pn-table-cards">
            <thead>
              <tr>
                <th>Artikal</th>
                <th>Plaćanje</th>
                <th className="pn-r">Pre</th>
                <th className="pn-r">Posle</th>
              </tr>
            </thead>
            <tbody>
              {n.items.map((it, i) => (
                <tr key={i}>
                  <td data-label="Artikal"><strong>{it.name}</strong> <span className="pn-sub pn-num">{it.code}</span></td>
                  <td data-label="Plaćanje">{it.option}</td>
                  <td data-label="Pre" className="pn-r pn-muted">{it.before}</td>
                  <td data-label="Posle" className="pn-r pn-strong">{it.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {n.note ? <p className="pn-small" style={{ padding: "10px 18px", borderTop: "1px solid var(--p-line)" }}><span className="pn-muted">Napomena:</span> {n.note}</p> : null}
        </section>
      ))}
    </div>
  );
}
