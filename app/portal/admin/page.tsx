import { eq } from "drizzle-orm";
import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";
import { ThresholdSettings } from "@/features/portal/ThresholdSettings";

export const metadata = { title: "Administracija" };

export const dynamic = "force-dynamic";

const DEFAULTS = { t70: 70, t90: 90, t100: 100, tDelay: 15 };

export default async function AdminPage() {
  const user = await requireCapability("view:admin", "/portal/admin");
  // Po sposobnosti, kao i radnja (`settings:manage`): vlasniku je daje uloga, bez paketa „pragovi".
  const canManage = can(user, "settings:manage");

  const rows = await getDb()
    .select({ value: systemSettings.value })
    .from(systemSettings)
    .where(eq(systemSettings.key, "pragovi.limit"))
    .limit(1);

  const stored = rows[0]?.value as Partial<typeof DEFAULTS> | undefined;
  const thresholds = { ...DEFAULTS, ...(stored ?? {}) };

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Administracija"
        description="Sistemska pravila i pragovi. Svaka izmena traži razlog i evidentira se u Aktivnostima."
      />

      <ThresholdSettings thresholds={thresholds} canManage={canManage} />

      <PhaseNotice
        icon="settings"
        title="Ostala konfiguracija stiže sa integracijama"
        summary="Podešavanja BEX naloga se otvaraju kada BEX bude povezan. Do tada se ne prikazuju prazna polja koja ništa ne čuvaju."
        requires={[
          "BEX pristupni podaci i odluka o test okruženju.",
          "Konektor za fakture se podešava na samom uređaju (Windows paket), a prati u Sinhronizaciji; lager se uvozi kroz Uvoz lagera.",
        ]}
        availability="Dostupno nakon povezivanja BEX naloga"
      />
    </>
  );
}
