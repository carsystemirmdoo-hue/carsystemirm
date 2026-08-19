"use server";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { userPermissions, users } from "@/db/schema";
import { userRole } from "@/db/schema/users";
import { hashPassword } from "@/lib/auth/password.mjs";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { PACKAGE_KEYS, ROLE_LABELS } from "@/lib/authz/permissions.mjs";
import { requireCapability } from "@/lib/authz/session";

export type AdminActionState = { error: string | null; ok: string | null };

const toggleSchema = z.object({
  userId: z.string().uuid(),
  permissionKey: z.enum(PACKAGE_KEYS as [string, ...string[]]),
  grant: z.boolean(),
  reason: z.string().trim().min(3).max(500),
});

const roleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(userRole.enumValues),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Dodeljuje ili oduzima paket dozvola.
 *
 * Izmena i trag revizije idu kroz istu transakciju: ne može ostati promena bez
 * traga, ni trag bez promene.
 */
export async function togglePermissionAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireCapability("users:manage", "/portal/dozvole");

  const parsed = toggleSchema.safeParse({
    userId: formData.get("userId"),
    permissionKey: formData.get("permissionKey"),
    grant: formData.get("grant") === "1",
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: "Razlog izmene je obavezan (najmanje 3 znaka).", ok: null };
  }

  const { userId, permissionKey, grant, reason } = parsed.data;

  // Zaštita od zaključavanja sistema: poslednji nosilac paketa „korisnici“ ne
  // sme sam sebi da oduzme pristup administraciji korisnika.
  if (!grant && permissionKey === "korisnici" && userId === actor.id) {
    return {
      error:
        "Ne možete sebi oduzeti paket „Korisnici i dozvole“ — sistem bi ostao bez administratora.",
      ok: null,
    };
  }

  const db = getDb();
  const target = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (target.length === 0) return { error: "Korisnik ne postoji.", ok: null };

  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    if (grant) {
      await tx
        .insert(userPermissions)
        .values({ userId, permissionKey, grantedBy: actor.id, reason })
        .onConflictDoNothing();
    } else {
      await tx
        .delete(userPermissions)
        .where(
          and(
            eq(userPermissions.userId, userId),
            eq(userPermissions.permissionKey, permissionKey),
          ),
        );
    }

    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: grant
          ? AUDIT_ACTIONS.permissionGranted
          : AUDIT_ACTIONS.permissionRevoked,
        entityType: "Korisnik",
        entityId: userId,
        entityLabel: target[0].name,
        before: { [permissionKey]: !grant },
        after: { [permissionKey]: grant },
        reason,
        correlationId,
      },
      tx,
    );
  });

  revalidatePath("/portal/dozvole");
  return {
    error: null,
    ok: `${grant ? "Dodeljen" : "Oduzet"} paket „${permissionKey}“ korisniku ${target[0].name}.`,
  };
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(120),
  role: z.enum(userRole.enumValues),
  password: z.string().min(10).max(200),
});

function initialsFrom(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/**
 * Otvara nalog zaposlenom. Novi korisnik dobija samo ono što nosi njegova uloga;
 * paketi dozvola se dodeljuju posebno, da bi svaka dodela imala svoj razlog i
 * svoj zapis u tragu revizije.
 */
export async function createUserAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireCapability("users:manage", "/portal/dozvole");

  const parsed = createSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    role: formData.get("role"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error:
        "Proverite unos: ispravna e-pošta, ime od najmanje 2 znaka i lozinka od najmanje 10 znakova.",
      ok: null,
    };
  }

  const { email, name, role, password } = parsed.data;
  const db = getDb();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return { error: "Nalog sa tom e-poštom već postoji.", ok: null };
  }

  const passwordHash = await hashPassword(password);
  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email,
        name,
        initials: initialsFrom(name),
        passwordHash,
        role,
      })
      .returning({ id: users.id });

    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.userCreated,
        entityType: "Korisnik",
        entityId: created.id,
        entityLabel: email,
        // Lozinka se ne prosleđuje u trag revizije; builder je i inače redigovao.
        after: { ime: name, uloga: ROLE_LABELS[role] },
        reason: `Nalog otvorio ${actor.name}`,
        correlationId,
      },
      tx,
    );
  });

  revalidatePath("/portal/dozvole");
  return { error: null, ok: `Nalog ${email} je otvoren.` };
}

/** Menja osnovnu ulogu korisnika. Uloga „Menadžer“ ne postoji u modelu. */
export async function changeRoleAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireCapability("users:manage", "/portal/dozvole");

  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    return { error: "Razlog izmene je obavezan (najmanje 3 znaka).", ok: null };
  }

  const { userId, role, reason } = parsed.data;
  const db = getDb();
  const target = await db
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (target.length === 0) return { error: "Korisnik ne postoji.", ok: null };
  if (target[0].role === role) return { error: null, ok: "Uloga je nepromenjena." };

  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ role, updatedAt: new Date() })
      .where(eq(users.id, userId));

    await recordAudit(
      {
        actor: { id: actor.id, name: actor.name, role: actor.role },
        action: AUDIT_ACTIONS.roleChanged,
        entityType: "Korisnik",
        entityId: userId,
        entityLabel: target[0].name,
        before: { uloga: ROLE_LABELS[target[0].role] },
        after: { uloga: ROLE_LABELS[role] },
        reason,
        correlationId,
      },
      tx,
    );
  });

  revalidatePath("/portal/dozvole");
  return {
    error: null,
    ok: `Uloga korisnika ${target[0].name} je promenjena u ${ROLE_LABELS[role]}.`,
  };
}
