import { eq } from "drizzle-orm";
import { PhaseNotice } from "@/components/portal/PhaseNotice";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { requireCapability } from "@/lib/authz/session";
import { ThresholdSettings } from "@/features/portal/ThresholdSettings";

export const dynamic = "force-dynamic";

const DEFAULTS = { t70: 70, t90: 90, t100: 100, tDelay: 15 };

export default async function AdminPage() {
  const user = await requireCapability("view:admin", "/portal/admin");
  const canManage = user.permissions.includes("pragovi");

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
        summary="Podešavanja konektora za fakture, BEX naloga i uvoza zaliha se otvaraju kada te integracije budu povezane. Do tada se ne prikazuju prazna polja koja ništa ne čuvaju."
        requires={[
          "Putanja i pristup folderu sa BiznisSoft izvozom (faza 2).",
          "BEX pristupni podaci i odluka o test okruženju (faza 3).",
          "Izvor stanja zaliha (faza 4).",
        ]}
        phase="faze 2–4"
      />
    </>
  );
}
