import type { Metadata } from "next";
import { asc, ne } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { readMfaStatus } from "@/lib/auth/mfa-service";
import { hasOpenResetCode } from "@/lib/auth/password-reset";
import { ROLE_LABELS } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireFullPortalUser } from "@/lib/authz/session";
import { SECURITY_ADMIN_CAPABILITY } from "@/lib/authz/security-admin";
import { SecurityAdmin, type AccountRow } from "./SecurityAdmin";

export const metadata: Metadata = {
  title: "Bezbednost naloga · Poslovni sistem",
  robots: { index: false, follow: false, noarchive: true },
};

/*
 * Nikad iz keša: odgovor u nekom trenutku nosi izdati kod za promenu lozinke
 * ili dozvolu za vezivanje. Zaglavlje `no-store` postavlja `next.config.ts` za
 * celu granu `/portal/bezbednost`.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Administracija tuđih naloga.
 *
 * Strana traži istu sposobnost kao i same akcije. To je namerno dupliranje na
 * dva sloja: kapija u akciji je ta koja stvarno štiti, jer se server akcija
 * može pozvati i bez otvaranja strane. Provera ovde samo sprečava da neko vidi
 * spisak naloga koji ga se ne tiče.
 */
export default async function SecurityAccountsPage() {
  await requireFullPortalUser("/portal/bezbednost/nalozi");
  const actor = await requireCapability(
    SECURITY_ADMIN_CAPABILITY,
    "/portal/bezbednost/nalozi",
  );

  const rows = await getDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
    })
    .from(users)
    // Sopstveni nalog se ne prikazuje: nijedna radnja ovde ne sme nad njim.
    .where(ne(users.id, actor.id))
    .orderBy(asc(users.name));

  const accounts: AccountRow[] = await Promise.all(
    rows.map(async (row) => {
      const [status, openReset] = await Promise.all([
        readMfaStatus(row.id),
        hasOpenResetCode(row.id),
      ]);
      return {
        ...row,
        roleLabel: ROLE_LABELS[row.role] ?? row.role,
        mfaEnabled: status.enabled,
        hasOpenReset: openReset,
      };
    }),
  );

  return (
    <>
      <PageHeader
        eyebrow="Bezbednost"
        title="Nalozi zaposlenih"
        description="Kodovi za promenu lozinke, dozvole za vezivanje drugog faktora, isključivanje i vraćanje naloga."
      />
      <SecurityAdmin accounts={accounts} />
    </>
  );
}
