"use server";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { users } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { issueEnrollmentGrant, revokeEnrollmentGrants } from "@/lib/auth/enrollment-grant";
import { readMfaStatus, resetMfaForUser } from "@/lib/auth/mfa-service";
import { issuePasswordResetCode } from "@/lib/auth/password-reset";
import {
  revokeUserSessions,
  revokeUserSessionsStandalone,
} from "@/lib/auth/session-revocation";
import {
  loadSecurityTarget,
  removesActiveOwner,
  requireSecurityAdmin,
  SecurityActionError,
  withOwnerGuard,
} from "@/lib/authz/security-admin";
import { EMPTY_SECURITY_ADMIN, type SecurityAdminState } from "./types";

/**
 * Bezbednosne radnje nad tuđim nalogom.
 *
 * Svaka akcija ovde počinje istim pozivom — `requireSecurityAdmin(token)` — koji
 * traži punu sesiju, sposobnost `users:manage` i **svež kod iz aplikacije**.
 * Nijedna ne sme da izmisli sopstvenu proveru; kapija je jedna.
 *
 * Nijedna ne radi nad sopstvenim nalogom administratora. Za svoje stvari
 * postoje samouslužni ekrani, a zabrana sprečava da vlasnik sam sebi obori
 * drugi faktor i time zaobiđe zaštitu koju upravo sprovodi.
 */

const targetSchema = z.object({
  userId: z.string().uuid(),
  token: z.string().trim().min(6).max(8),
  reason: z.string().trim().min(3).max(500),
});

/**
 * Prevodi izuzetke u poruku obrasca.
 *
 * `forbidden()` i `redirect()` iz Next-a se NE hvataju — oni rade kroz bacanje
 * i moraju proći dalje, inače bi 403 postao poruka „nešto nije u redu".
 */
function toState(error: unknown): SecurityAdminState {
  if (error instanceof SecurityActionError) {
    return { ...EMPTY_SECURITY_ADMIN, error: error.message };
  }
  throw error;
}

function parse(formData: FormData) {
  const parsed = targetSchema.safeParse({
    userId: formData.get("userId"),
    token: formData.get("token"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    throw new SecurityActionError(
      "Unesite razlog (najmanje 3 znaka) i kod iz aplikacije.",
    );
  }
  return parsed.data;
}

/* =========================================================================
 * d2 — kod za promenu lozinke
 * ====================================================================== */

/**
 * Izdaje kod kojim zaposleni sam postavlja novu lozinku.
 *
 * Administrator NE bira tuđu lozinku. Da je bira, znao bi je — a onda bi svaka
 * kasnija radnja tog naloga mogla biti i njegova. Ovako novu lozinku zna samo
 * njen vlasnik.
 *
 * Kod se vraća u odgovoru i prikazuje jednom; u bazi ostaje samo HMAC otisak.
 */
export async function issueResetCodeAction(
  _previous: SecurityAdminState,
  formData: FormData,
): Promise<SecurityAdminState> {
  try {
    const { userId, token, reason } = parse(formData);
    const actor = await requireSecurityAdmin(token);
    const target = await loadSecurityTarget(userId, { actorId: actor.id, actorRole: actor.role });

    if (!target.active) {
      throw new SecurityActionError(
        "Nalog je deaktiviran. Prvo ga reaktivirajte, pa izdajte kod.",
      );
    }

    const correlationId = randomUUID();
    const { code, expiresAt } = await issuePasswordResetCode({
      userId: target.id,
      issuedBy: actor.id,
    });

    await recordAudit({
      actor: { id: actor.id, name: actor.name, role: actor.role },
      action: AUDIT_ACTIONS.passwordResetIssued,
      entityType: "Korisnik",
      entityId: target.id,
      entityLabel: target.email,
      // Ni kod ni njegov otisak ne ulaze u trag.
      reason,
      correlationId,
    });
    await recordAudit({
      actor: { id: actor.id, name: actor.name, role: actor.role },
      action: AUDIT_ACTIONS.sessionsRevoked,
      entityType: "Korisnik",
      entityId: target.id,
      entityLabel: target.email,
      reason: "Sesije opozvane pri izdavanju koda za promenu lozinke",
      correlationId,
    });

    revalidatePath("/portal/bezbednost/nalozi");
    return {
      error: null,
      ok: null,
      issued: {
        kind: "reset",
        code,
        expiresAt: expiresAt.toISOString(),
        targetEmail: target.email,
      },
    };
  } catch (error) {
    return toState(error);
  }
}

/* =========================================================================
 * d3 — isključivanje i vraćanje naloga
 * ====================================================================== */

const activeSchema = targetSchema.extend({ active: z.boolean() });

/**
 * Isključuje ili vraća nalog.
 *
 * Deaktivacija ide kroz `withOwnerGuard`: pod bravom se proverava da posle
 * radnje ostaje bar jedan aktivan vlasnik. Reaktivacija ne može nikoga ukloniti
 * pa bravu ne traži, ali ide kroz isti put da bi izmena, opoziv sesija i trag
 * ostali u jednoj transakciji.
 */
export async function setAccountActiveAction(
  _previous: SecurityAdminState,
  formData: FormData,
): Promise<SecurityAdminState> {
  try {
    const base = parse(formData);
    const parsed = activeSchema.safeParse({
      ...base,
      active: formData.get("active") === "1",
    });
    if (!parsed.success) throw new SecurityActionError("Neispravan zahtev.");

    const actor = await requireSecurityAdmin(base.token);
    const target = await loadSecurityTarget(base.userId, { actorId: actor.id, actorRole: actor.role });
    const nextActive = parsed.data.active;

    if (target.active === nextActive) {
      return {
        ...EMPTY_SECURITY_ADMIN,
        ok: `Nalog ${target.email} je već ${nextActive ? "aktivan" : "isključen"}.`,
      };
    }

    const correlationId = randomUUID();
    const now = new Date();

    await withOwnerGuard(
      {
        targetId: target.id,
        removesOwner: removesActiveOwner(target, { nextActive }),
      },
      async (tx) => {
        await tx
          .update(users)
          .set({ active: nextActive, updatedAt: now })
          .where(eq(users.id, target.id));

        /*
         * Sesije padaju u OBA smera.
         *
         * Pri isključivanju je očigledno. Pri vraćanju je manje očigledno ali
         * jednako važno: nalog je bio isključen sa razlogom, pa token izdat pre
         * toga ne sme da oživi zajedno sa nalogom.
         */
        await revokeUserSessions(tx, target.id, now);

        const auditActor = { id: actor.id, name: actor.name, role: actor.role };
        await recordAudit(
          {
            actor: auditActor,
            action: nextActive
              ? AUDIT_ACTIONS.userReactivated
              : AUDIT_ACTIONS.userDeactivated,
            entityType: "Korisnik",
            entityId: target.id,
            entityLabel: target.email,
            before: { aktivan: target.active },
            after: { aktivan: nextActive },
            reason: base.reason,
            correlationId,
          },
          tx,
        );
        await recordAudit(
          {
            actor: auditActor,
            action: AUDIT_ACTIONS.sessionsRevoked,
            entityType: "Korisnik",
            entityId: target.id,
            entityLabel: target.email,
            reason: nextActive
              ? "Sesije opozvane pri vraćanju naloga"
              : "Sesije opozvane pri isključivanju naloga",
            correlationId,
          },
          tx,
        );
      },
    );

    revalidatePath("/portal/bezbednost/nalozi");
    revalidatePath("/portal/dozvole");
    return {
      ...EMPTY_SECURITY_ADMIN,
      ok: `Nalog ${target.email} je ${nextActive ? "vraćen u rad" : "isključen"}.`,
    };
  } catch (error) {
    return toState(error);
  }
}

/* =========================================================================
 * d4 — poništavanje tuđeg drugog faktora
 * ====================================================================== */

/**
 * Poništava drugi faktor kada je zaposleni izgubio telefon.
 *
 * Briše i aktivnu i pending tajnu, sve rezervne kodove i sve otvorene dozvole —
 * zaostala dozvola izdata ranije bila bi otvoren put ka vezivanju bez odobrenja.
 * Odmah se izdaje NOVA dozvola, jer bez nje korisnik ne može ponovo da veže
 * faktor, a sa uključenim režimom `enforced` ne bi mogao ni da uđe.
 *
 * Administrator ovo ne sme nad sobom: to bi bio način da sam sebi skine zaštitu
 * koju upravo sprovodi.
 */
export async function resetUserMfaAction(
  _previous: SecurityAdminState,
  formData: FormData,
): Promise<SecurityAdminState> {
  try {
    const { userId, token, reason } = parse(formData);
    const actor = await requireSecurityAdmin(token);
    const target = await loadSecurityTarget(userId, { actorId: actor.id, actorRole: actor.role });

    const correlationId = randomUUID();

    await resetMfaForUser({ userId: target.id });
    await revokeEnrollmentGrants(target.id);
    await revokeUserSessionsStandalone(target.id);

    const { code, expiresAt } = await issueEnrollmentGrant({
      userId: target.id,
      issuedBy: actor.id,
    });

    const auditActor = { id: actor.id, name: actor.name, role: actor.role };
    await recordAudit({
      actor: auditActor,
      action: AUDIT_ACTIONS.mfaReset,
      entityType: "Korisnik",
      entityId: target.id,
      entityLabel: target.email,
      reason,
      correlationId,
    });
    await recordAudit({
      actor: auditActor,
      action: AUDIT_ACTIONS.sessionsRevoked,
      entityType: "Korisnik",
      entityId: target.id,
      entityLabel: target.email,
      reason: "Sesije opozvane pri poništavanju drugog faktora",
      correlationId,
    });
    await recordAudit({
      actor: auditActor,
      action: AUDIT_ACTIONS.mfaGrantIssued,
      entityType: "Korisnik",
      entityId: target.id,
      entityLabel: target.email,
      reason: "Nova dozvola izdata odmah po poništavanju faktora",
      correlationId,
    });

    revalidatePath("/portal/bezbednost/nalozi");
    return {
      error: null,
      ok: null,
      issued: {
        kind: "grant",
        code,
        expiresAt: expiresAt.toISOString(),
        targetEmail: target.email,
      },
    };
  } catch (error) {
    return toState(error);
  }
}

/* =========================================================================
 * d5 — dozvola za vezivanje
 * ====================================================================== */

/**
 * Izdaje dozvolu za prvo vezivanje drugog faktora.
 *
 * Namenjena je nalogu koji faktor još NEMA. Ko ga ima i menja telefon prolazi
 * kroz `/portal/bezbednost/mfa` sa lozinkom i tekućim kodom — davanje dozvole
 * takvom nalogu bilo bi prečica koja zaobilazi postojeći faktor. Kada je uređaj
 * stvarno izgubljen, ispravan put je poništavanje faktora (d4), koje nosi svoj
 * trag u reviziji.
 */
export async function issueEnrollmentGrantAction(
  _previous: SecurityAdminState,
  formData: FormData,
): Promise<SecurityAdminState> {
  try {
    const { userId, token, reason } = parse(formData);
    const actor = await requireSecurityAdmin(token);
    const target = await loadSecurityTarget(userId, { actorId: actor.id, actorRole: actor.role });

    const status = await readMfaStatus(target.id);
    if (status.enabled) {
      throw new SecurityActionError(
        "Nalog već ima drugi faktor. Za izgubljen uređaj koristite poništavanje faktora.",
      );
    }
    if (!target.active) {
      throw new SecurityActionError(
        "Nalog je isključen. Prvo ga vratite u rad.",
      );
    }

    const { code, expiresAt } = await issueEnrollmentGrant({
      userId: target.id,
      issuedBy: actor.id,
    });

    await recordAudit({
      actor: { id: actor.id, name: actor.name, role: actor.role },
      action: AUDIT_ACTIONS.mfaGrantIssued,
      entityType: "Korisnik",
      entityId: target.id,
      entityLabel: target.email,
      reason,
      correlationId: randomUUID(),
    });

    revalidatePath("/portal/bezbednost/nalozi");
    return {
      error: null,
      ok: null,
      issued: {
        kind: "grant",
        code,
        expiresAt: expiresAt.toISOString(),
        targetEmail: target.email,
      },
    };
  } catch (error) {
    return toState(error);
  }
}
