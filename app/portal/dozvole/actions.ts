"use server";

import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db/client";
import { userPermissions, users } from "@/db/schema";
import { userRole } from "@/db/schema/users";
import { hashPassword } from "@/lib/auth/password.mjs";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { PACKAGE_KEYS, ROLE_LABELS } from "@/lib/authz/permissions.mjs";
import { canGrantOwnerRole, OWNER_ROLE } from "@/lib/authz/owner-guard-policy.mjs";
import { requireCapability } from "@/lib/authz/session";
import {
  removesActiveOwner,
  requireSecurityAdmin,
  SECURITY_GENERIC_ERROR,
  SecurityActionError,
  withOwnerGuard,
} from "@/lib/authz/security-admin";

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
  // Promena uloge je visokorizična radnja: vidi `changeRoleAction`.
  token: z.string().trim().min(6).max(8),
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

const createSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    name: z.string().trim().min(2).max(120),
    role: z.enum(userRole.enumValues),
    password: z.string().min(10).max(200),
    /*
     * Traži se samo kada je `role` „gazda“ — vidi proveru ispod. Isti oblik kao
     * `roleSchema.token` (changeRoleAction), da dva unosa istog koda ne bi
     * imala različita pravila.
     */
    token: z.string().trim().max(8).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.role === OWNER_ROLE && data.token.length < 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Otvaranje naloga sa ulogom „gazda“ traži svež kod iz aplikacije.",
        path: ["token"],
      });
    }
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
    token: formData.get("token") ?? "",
  });
  if (!parsed.success) {
    // Poruka o kodu je specifičnija — samo ona kaže ZAŠTO je unos odbijen kada
    // je oblik inače ispravan i jedino polje koje „gazda“ nalog traži nedostaje.
    const tokenIssue = parsed.error.issues.find((issue) =>
      issue.path.includes("token"),
    );
    return {
      error:
        tokenIssue?.message ??
        "Proverite unos: ispravna e-pošta, ime od najmanje 2 znaka i lozinka od najmanje 10 znakova.",
      ok: null,
    };
  }

  const { email, name, role, password, token } = parsed.data;

  if (role === OWNER_ROLE) {
    /*
     * Ko sme da POSTAVI vlasnika mora sam već biti vlasnik.
     *
     * `users:manage_security` je namerno delegabilna van uloge „gazda" (paket
     * „Bezbednost naloga"), pa sama po sebi NIJE dokaz vlasništva — samo
     * dokaz da je pozivaocu poverena bezbednosna administracija tuđih naloga.
     * Bez ove provere, bilo ko sa tim delegiranim paketom i svežim TOTP-om bi
     * mogao da UMNOŽI broj vlasnika, iako sam nije jedan od njih. Provera ide
     * PRE `requireSecurityAdmin`: odbijen pokušaj se ne sme ni približiti
     * proveri TOTP-a, ispravnog ili ne.
     */
    if (!canGrantOwnerRole(actor, role)) {
      return { error: SECURITY_GENERIC_ERROR, ok: null };
    }

    /*
     * Otvaranje naloga sa ulogom „gazda" dodatno ide kroz ISTU kapiju kao i
     * prebacivanje postojećeg naloga u tu ulogu (`changeRoleAction`): puna
     * sesija, sposobnost `users:manage_security` i svež TOTP unet baš za ovu
     * radnju. Provera ide PRE bilo kog upita u bazu: odbijen pokušaj ne sme
     * ostaviti ni delimičan trag.
     */
    try {
      await requireSecurityAdmin(token);
    } catch (error) {
      if (error instanceof SecurityActionError) {
        return { error: error.message, ok: null };
      }
      throw error;
    }
  }

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

/**
 * Menja osnovnu ulogu korisnika. Uloga „Menadžer“ ne postoji u modelu.
 *
 * Ide kroz istu kapiju kao reset lozinke i poništavanje faktora — puna sesija,
 * sposobnost za bezbednost naloga i **svež kod iz aplikacije**.
 *
 * Razlog: promena uloge je jedan od načina da se preuzme ili obori tuđ pristup.
 * Prebacivanje poslednjeg vlasnika u drugu ulogu nikoga ne isključuje, ali
 * ostavlja firmu bez upravljanja nalozima; dodela uloge „gazda“ radi suprotno.
 * Kapija je ista, pa se pravila ne mogu razići.
 */
export async function changeRoleAction(
  _previous: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const parsed = roleSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    reason: formData.get("reason") ?? "",
    token: formData.get("token") ?? "",
  });
  if (!parsed.success) {
    return {
      error: "Unesite razlog (najmanje 3 znaka) i kod iz aplikacije.",
      ok: null,
    };
  }

  let actor;
  try {
    actor = await requireSecurityAdmin(parsed.data.token);
  } catch (error) {
    if (error instanceof SecurityActionError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }

  const { userId, role, reason } = parsed.data;
  const db = getDb();
  const target = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (target.length === 0) return { error: "Korisnik ne postoji.", ok: null };
  if (target[0].role === role)
    return { error: null, ok: "Uloga je nepromenjena." };

  const correlationId = randomUUID();

  /*
   * Promena uloge je jedan od puteva koji mogu ostaviti sistem bez vlasnika.
   *
   * Deaktivacija je očigledan put; ovaj je podmukliji — poslednji „gazda"
   * prebačen u „komercijalista" nikoga ne isključuje, ali niko više ne može da
   * upravlja nalozima. Zato ide kroz istu bravu, a ne kroz sopstvenu proveru:
   * dva puta ka istoj posledici moraju deliti istu zaštitu.
   */
  try {
    await withOwnerGuard(
      {
        targetId: userId,
        removesOwner: removesActiveOwner(target[0], { nextRole: role }),
      },
      async (tx) => {
        await tx
          .update(users)
          .set({
            role,
            /*
             * Promena uloge poništava sve otvorene sesije tog korisnika.
             *
             * Same dozvole bi se promenile i bez ovoga — čitaju se iz baze pri
             * svakom zahtevu. Opoziv je tu zbog onoga što se ne vidi iz dozvola:
             * ako je uloga menjana zato što je nalog kompromitovan ili je čovek
             * promenio posao, token u tuđim rukama ne sme da preživi tu odluku.
             *
             * Kolona se povećava u istoj transakciji kao i uloga, pa ne postoji
             * trenutak u kome je uloga nova a sesija stara.
             */
            sessionVersion: sql`${users.sessionVersion} + 1`,
            updatedAt: new Date(),
          })
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
      },
    );
  } catch (error) {
    if (error instanceof SecurityActionError) {
      return { error: error.message, ok: null };
    }
    throw error;
  }

  revalidatePath("/portal/dozvole");
  return {
    error: null,
    ok: `Uloga korisnika ${target[0].name} je promenjena u ${ROLE_LABELS[role]}.`,
  };
}
