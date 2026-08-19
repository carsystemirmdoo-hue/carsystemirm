import { asc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/portal/PortalPrimitives";
import { getDb } from "@/db/client";
import { userPermissions, users } from "@/db/schema";
import { requireCapability } from "@/lib/authz/session";
import { PermissionMatrix } from "@/features/portal/PermissionMatrix";

export const dynamic = "force-dynamic";

export default async function PermissionsPage() {
  const actor = await requireCapability("view:dozvole", "/portal/dozvole");
  const canManage = actor.permissions.includes("korisnici");

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      initials: users.initials,
      role: users.role,
      active: users.active,
      permission: userPermissions.permissionKey,
    })
    .from(users)
    .leftJoin(userPermissions, eq(userPermissions.userId, users.id))
    .orderBy(asc(users.name));

  const byUser = new Map<
    string,
    {
      id: string;
      name: string;
      email: string;
      initials: string;
      role: (typeof rows)[number]["role"];
      active: boolean;
      permissions: string[];
    }
  >();
  for (const row of rows) {
    const existing = byUser.get(row.id);
    if (existing) {
      if (row.permission) existing.permissions.push(row.permission);
      continue;
    }
    byUser.set(row.id, {
      id: row.id,
      name: row.name,
      email: row.email,
      initials: row.initials,
      role: row.role,
      active: row.active,
      permissions: row.permission ? [row.permission] : [],
    });
  }

  return (
    <>
      <PageHeader
        eyebrow="Sistem"
        title="Korisnici i dozvole"
        description="Uloga nosi osnovni pristup, a paketi dozvola ga proširuju. Svaka izmena traži razlog i upisuje se u Aktivnosti."
      />
      <PermissionMatrix
        users={[...byUser.values()]}
        canManage={canManage}
        actorId={actor.id}
      />
    </>
  );
}
