import { eq } from "drizzle-orm";
import { can } from "@/lib/authz/permissions.mjs";
import { listRepsWithCustomerCount } from "@/lib/partners/assignment-service";
import { RepTransfer } from "./RepTransfer";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { systemSettings } from "@/db/schema";
import { requireCapability } from "@/lib/authz/session";
import { ThresholdSettings } from "@/features/portal/ThresholdSettings";


export const metadata = { title: "Administracija" };

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

      {can(user, "assignments:manage") ? <RepTransfer reps={await listRepsWithCustomerCount()} /> : null}

      <p className="portal-footnote">
        Otprema, adresnice i BEX čekaju BEX nalog (pristupni podaci i test okruženje) i zato nisu u meniju. Fakture stižu preko
        konektora (Importi → Sinhronizacija), a lager na ekranu Uvoz lagera.
      </p>
    </>
  );
}
