"use server";

import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { verifyPassword } from "@/lib/auth/password.mjs";
import {
  consumeEnrollmentGrant,
  hasOpenEnrollmentGrant,
} from "@/lib/auth/enrollment-grant";
import {
  beginMfaEnrollment,
  confirmMfaEnrollment,
  readMfaStatus,
  regenerateRecoveryCodes,
  verifyTotpForUser,
} from "@/lib/auth/mfa-service";
import { clientIpFromRequest } from "@/lib/auth/client-ip";
import {
  clearAccountAttempts,
  isBucketBlocked,
  registerAttempt,
} from "@/lib/auth/rate-limit-service";
import { requireEnrollmentUser, requireFullPortalUser } from "@/lib/authz/session";
import { findUserByEmail } from "@/lib/authz/user-repository";
import { EMPTY_ENROLLMENT, type EnrollmentState } from "./types";

/**
 * Vezivanje drugog faktora.
 *
 * Sve akcije ovde rade nad SOPSTVENIM nalogom prijavljenog korisnika. Nijedna ne
 * prima `userId` spolja — inače bi jedan izostavljen `if` značio da neko veže
 * faktor na tuđ nalog.
 *
 * Odgovori namerno ne otkrivaju u čemu je greška: pogrešna lozinka, pogrešna
 * dozvola i istekao pokušaj vraćaju istu poruku.
 */

/** Ista poruka za sve odbijene pokušaje — razlog ide u audit, ne korisniku. */
const GENERIC = "Podaci nisu ispravni ili je dozvola istekla. Zatražite novu.";
const TOO_MANY = "Previše pokušaja. Sačekajte nekoliko minuta pa pokušajte ponovo.";

/**
 * Isti brojač kao promena lozinke (`totp`): ovi ekrani proveravaju lozinku i
 * kod iza otvorene sesije, pa bez njega otvoren laptop omogućava neograničeno
 * pogađanje (revizija 2026-10-11, B9).
 *
 * `null` = provera prošla; inače poruka za korisnika.
 */
async function checkWithLimit(email: string, check: () => Promise<boolean>): Promise<string | null> {
  const clientIp = await clientIpFromRequest();
  if (await isBucketBlocked({ scope: "totp", accountIdentifier: email, clientIp })) return TOO_MANY;
  if (!(await check())) {
    await registerAttempt({ scope: "totp", accountIdentifier: email, clientIp });
    return GENERIC;
  }
  await clearAccountAttempts("totp", email);
  return null;
}

/**
 * Korak 1 — pravi pending tajnu.
 *
 * Traži i trenutnu lozinku i jednokratnu dozvolu. Lozinka sama nije dovoljna:
 * napadač koji je do nje došao mogao bi prvi da veže svoj uređaj i zaključa
 * pravog vlasnika napolju.
 */
export async function startEnrollmentAction(
  _previous: EnrollmentState,
  formData: FormData,
): Promise<EnrollmentState> {
  // Enrollment-only sesija sme ovde — to je jedina ruta koja je prima.
  const user = await requireEnrollmentUser();
  const status = await readMfaStatus(user.id);

  const password = String(formData.get("password") ?? "");
  const grant = String(formData.get("grant") ?? "");
  const currentToken = String(formData.get("token") ?? "");

  /*
   * Promena uređaja traži i kod sa TRENUTNOG uređaja, ne samo lozinku: inače
   * napadač sa lozinkom i otvorenom sesijom veže svoj telefon i zaključa
   * vlasnika napolju. Izgubljen telefon rešava vlasnik poništavanjem faktora.
   */
  const failed = await checkWithLimit(user.email, async () => {
    const record = await findUserByEmail(user.email);
    const passwordOk = record !== null && (await verifyPassword(password, record.passwordHash));
    const tokenOk = status.enabled ? await verifyTotpForUser({ userId: user.id, token: currentToken }) : true;
    return passwordOk && tokenOk;
  });
  if (failed) return { ...EMPTY_ENROLLMENT, error: failed };

  /*
   * Dozvola se traži samo kada faktor još nije aktivan.
   *
   * Ko već ima MFA i menja uređaj dokazuje identitet samim tim što je prošao
   * drugi faktor pri prijavi — tražiti mu i dozvolu značilo bi da mora zvati
   * vlasnika pri svakoj promeni telefona.
   */
  if (!status.enabled) {
    if (!(await consumeEnrollmentGrant({ userId: user.id, code: grant }))) {
      return { ...EMPTY_ENROLLMENT, error: GENERIC };
    }
  }

  const setup = await beginMfaEnrollment({
    userId: user.id,
    accountLabel: user.email,
  });

  await recordAudit({
    actor: { id: user.id, name: user.name, role: user.role },
    action: AUDIT_ACTIONS.mfaEnrollmentStarted,
    entityType: "Korisnik",
    entityId: user.id,
    entityLabel: user.email,
    // Ni tajna ni dozvola ne ulaze u trag.
    reason: "Započeto vezivanje aplikacije za jednokratne kodove",
  });

  return {
    error: null,
    // Vraća se ISKLJUČIVO ono što korisnik mora da vidi. Bez ciphertexta,
    // bez IV-a, bez taga, bez verzije ključa.
    setup: {
      base32: setup.base32,
      uri: setup.uri,
      expiresAt: setup.expiresAt.toISOString(),
    },
    recoveryCodes: null,
    done: false,
  };
}

/**
 * Korak 2 — prvi ispravan kod aktivira faktor.
 *
 * Rezervni kodovi stižu u odgovoru ove akcije i to je jedini put kada postoje u
 * čitljivom obliku. `session_version` se povećava, pa tekuća sesija pada — ali
 * tek pri sledećem zahtevu, što je dovoljno da se kodovi prikažu.
 */
export async function confirmEnrollmentAction(
  _previous: EnrollmentState,
  formData: FormData,
): Promise<EnrollmentState> {
  const user = await requireEnrollmentUser();
  const token = String(formData.get("token") ?? "");

  const result = await confirmMfaEnrollment({ userId: user.id, token });
  if (!result.ok) {
    return {
      ...EMPTY_ENROLLMENT,
      error: "Kod nije prihvaćen. Proverite vreme na telefonu i pokušajte ponovo.",
    };
  }

  await getDb()
    .update(users)
    .set({
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await recordAudit({
    actor: { id: user.id, name: user.name, role: user.role },
    action: AUDIT_ACTIONS.mfaEnabled,
    entityType: "Korisnik",
    entityId: user.id,
    entityLabel: user.email,
    reason: "Drugi faktor aktiviran; sve prethodne sesije opozvane",
  });

  return {
    error: null,
    setup: null,
    recoveryCodes: result.recoveryCodes,
    done: true,
  };
}

/**
 * Nov set rezervnih kodova.
 *
 * Traži i lozinku i svež kod iz aplikacije: ko dođe do otvorene sesije ne sme
 * moći da sebi izda nove kodove i time zadrži pristup i posle promene lozinke.
 */
export async function regenerateRecoveryAction(
  _previous: EnrollmentState,
  formData: FormData,
): Promise<EnrollmentState> {
  const user = await requireFullPortalUser();

  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "");

  const failed = await checkWithLimit(user.email, async () => {
    const record = await findUserByEmail(user.email);
    const passwordOk = record !== null && (await verifyPassword(password, record.passwordHash));
    // Ista replay zaštita kao pri prijavi — potrošen prozor ne prolazi drugi put.
    // Kod se proverava i kada je lozinka pogrešna (isto vreme odgovora).
    const tokenOk = await verifyTotpForUser({ userId: user.id, token });
    return passwordOk && tokenOk;
  });
  if (failed) return { ...EMPTY_ENROLLMENT, error: failed };

  const codes = await regenerateRecoveryCodes({ userId: user.id });

  await recordAudit({
    actor: { id: user.id, name: user.name, role: user.role },
    action: AUDIT_ACTIONS.recoveryCodesRegenerated,
    entityType: "Korisnik",
    entityId: user.id,
    entityLabel: user.email,
    reason: `Izdat nov set rezervnih kodova (${codes.length}); prethodni više ne važi`,
  });

  return { error: null, setup: null, recoveryCodes: codes, done: false };
}

/** Da li ekran uopšte treba da traži dozvolu. */
export async function readEnrollmentContext(userId: string) {
  const [status, grantOpen] = await Promise.all([
    readMfaStatus(userId),
    hasOpenEnrollmentGrant(userId),
  ]);
  return { status, grantOpen };
}
