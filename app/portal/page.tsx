import Link from "next/link";
import { redirect } from "next/navigation";
import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import {
  can,
  landingRouteFor,
  navGroupsFor,
  PERMISSION_PACKAGES,
  ROLE_LABELS,
} from "@/lib/authz/permissions.mjs";
import { requireUser } from "@/lib/authz/session";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const user = await requireUser("/portal");

  // Magacioner nema početnu stranu. Umesto 403 na adresi na koju prijava
  // podrazumevano vodi, otvara se prvi ekran koji sme da vidi.
  if (!can(user, "view:home")) redirect(landingRouteFor(user));

  const groups = navGroupsFor(user);
  const packages = PERMISSION_PACKAGES.filter((item) =>
    user.permissions.includes(item.key),
  );

  return (
    <>
      <PageHeader
        eyebrow="Pregled"
        title={`Dobar dan, ${user.name.split(" ")[0]}`}
        description={`Prijavljeni ste kao ${ROLE_LABELS[user.role]}. Ispod je tačan obim Vašeg pristupa.`}
      />

      <section className="portal-panel">
        <div className="portal-section-header">
          <div>
            <h2>Vaš pristup</h2>
            <p>
              Uloga određuje osnovni pristup, a paketi dozvola ga proširuju.
              Dodelu menja Gazda kroz Korisnike i dozvole.
            </p>
          </div>
        </div>
        <div className="portal-phase-notice">
          <h3>Dodeljeni paketi dozvola</h3>
          {packages.length > 0 ? (
            <ul>
              {packages.map((item) => (
                <li key={item.key}>
                  <strong>{item.name}</strong> — {item.description}
                </li>
              ))}
            </ul>
          ) : (
            <p className="portal-phase-notice-tag">
              Nemate dodatnih paketa — pristup je onaj koji nosi Vaša uloga.
            </p>
          )}
          <h3>Ekrani koje možete da otvorite</h3>
          <ul>
            {groups.map((group) => (
              <li key={group.label}>
                <strong>{group.label}:</strong>{" "}
                {group.items.map((item, index) => (
                  <span key={item.href}>
                    {index ? ", " : ""}
                    <Link href={item.href}>{item.label}</Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <PhaseNotice
        icon="chart"
        title="Brojke na početnoj čekaju uvoz faktura"
        summary="Dok se ne uveze prva partija faktura iz BiznisSoft izvoza, početna ne prikazuje promet, kupce ni upozorenja. Prazan ekran je ovde tačniji od izmišljenih vrednosti."
        requires={[
          "Instaliran lokalni konektor na računaru gde se nalazi folder sa izvozom.",
          "Prvi istorijski uvoz (nekoliko godina faktura) i zatim dnevni uvoz u 09:00.",
          "Za pokazatelje naplate je potreban odvojen, proveren izvor uplata — fakture ga ne sadrže.",
        ]}
        phase="faza 2"
      />
    </>
  );
}
