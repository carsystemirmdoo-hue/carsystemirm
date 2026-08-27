import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mfaEnrollmentGrants, users } from "@/db/schema";
import {
  activeKeyVersion,
  recoveryCodeFingerprint,
} from "@/lib/auth/mfa-crypto.mjs";
import { generateRecoveryCode, looksLikeRecoveryCode } from "@/lib/auth/recovery-codes.mjs";

/**
 * Jednokratna dozvola za vezivanje drugog faktora.
 *
 * Zašto uopšte postoji
 * --------------------
 * Bez nje bi sama lozinka bila dovoljna da se veže authenticator. Napadač koji
 * je došao do lozinke tada može **prvi** da veže svoj uređaj — i time trajno
 * preuzme nalog, jer bi pravi vlasnik ostao zaključan napolju. Vezivanje zato
 * traži i nešto što napadač nema: kod koji vlasnik izdaje van sistema.
 *
 * Kod ima isti oblik i istu entropiju kao rezervni kodovi (~147 bita) i čuva se
 * isključivo kao HMAC otisak.
 */

/** Kratak rok: dozvola se izdaje uživo i koristi odmah. */
const GRANT_TTL_MS = 30 * 60_000;

function env() {
  return {
    PORTAL_MFA_MASTER_KEY_V1: process.env.PORTAL_MFA_MASTER_KEY_V1,
    PORTAL_MFA_MASTER_KEY_V2: process.env.PORTAL_MFA_MASTER_KEY_V2,
    PORTAL_MFA_ACTIVE_KEY_VERSION: process.env.PORTAL_MFA_ACTIVE_KEY_VERSION,
  };
}

/**
 * Izdaje dozvolu i vraća je u čitljivom obliku — jedini put kada postoji.
 *
 * Prethodne neiskorišćene dozvole istog korisnika se poništavaju: u svakom
 * trenutku sme da važi najviše jedna, pa zaboravljena stara ne ostaje kao
 * otvorena vrata.
 */
export async function issueEnrollmentGrant(input: {
  userId: string;
  issuedBy: string | null;
  now?: Date;
}): Promise<{ code: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + GRANT_TTL_MS);
  const code = generateRecoveryCode();
  const keyVersion = activeKeyVersion(env());

  await getDb().transaction(async (tx) => {
    await tx
      .update(mfaEnrollmentGrants)
      .set({ supersededAt: now })
      .where(
        and(
          eq(mfaEnrollmentGrants.userId, input.userId),
          isNull(mfaEnrollmentGrants.usedAt),
          isNull(mfaEnrollmentGrants.supersededAt),
        ),
      );

    await tx.insert(mfaEnrollmentGrants).values({
      userId: input.userId,
      codeFingerprint: recoveryCodeFingerprint(code, env(), keyVersion),
      keyVersion,
      issuedBy: input.issuedBy,
      expiresAt,
      createdAt: now,
    });
  });

  return { code, expiresAt };
}

/**
 * Troši dozvolu.
 *
 * Uslovi su svi u `WHERE`: pravi korisnik, neiskorišćena, neponištena i još
 * važeća. Dva paralelna pokušaja sa istim kodom nalaze isti red, ali samo jedan
 * ga označi kao iskorišćen — drugi vidi nula redova i pada.
 *
 * Vezanost za korisnika je bitna: dozvola izdata jednom nalogu ne sme otvoriti
 * vezivanje na drugom.
 */
export async function consumeEnrollmentGrant(input: {
  userId: string;
  code: string;
  now?: Date;
}): Promise<boolean> {
  if (!looksLikeRecoveryCode(input.code)) return false;

  const now = input.now ?? new Date();
  const consumed = await getDb()
    .update(mfaEnrollmentGrants)
    .set({ usedAt: now })
    .where(
      and(
        eq(mfaEnrollmentGrants.userId, input.userId),
        eq(
          mfaEnrollmentGrants.codeFingerprint,
          recoveryCodeFingerprint(input.code, env()),
        ),
        isNull(mfaEnrollmentGrants.usedAt),
        isNull(mfaEnrollmentGrants.supersededAt),
        /*
         * Poređenje ide kroz `gt`, ne kroz sirov `sql` šablon.
         *
         * U šablonu vrednost putuje do drajvera bez tipa kolone, pa `Date`
         * stigne kao objekat koji drajver ne ume da serijalizuje
         * (`ERR_INVALID_ARG_TYPE`). Operator `gt` prolazi kroz maper kolone i
         * šalje ispravan `timestamptz`.
         */
        gt(mfaEnrollmentGrants.expiresAt, now),
      ),
    )
    .returning({ id: mfaEnrollmentGrants.id });

  return consumed.length === 1;
}

/** Poništava sve otvorene dozvole korisnika; koristi se pri MFA resetu. */
export async function revokeEnrollmentGrants(
  userId: string,
  now = new Date(),
): Promise<void> {
  await getDb()
    .update(mfaEnrollmentGrants)
    .set({ supersededAt: now })
    .where(
      and(
        eq(mfaEnrollmentGrants.userId, userId),
        isNull(mfaEnrollmentGrants.usedAt),
        isNull(mfaEnrollmentGrants.supersededAt),
      ),
    );
}

/**
 * Da li korisnik ima otvorenu dozvolu.
 *
 * Koristi se samo da ekran zna da li da traži kod — nikad kao zamena za
 * stvarno trošenje.
 */
export async function hasOpenEnrollmentGrant(
  userId: string,
  now = new Date(),
): Promise<boolean> {
  const rows = await getDb()
    .select({ id: mfaEnrollmentGrants.id })
    .from(mfaEnrollmentGrants)
    .where(
      and(
        eq(mfaEnrollmentGrants.userId, userId),
        isNull(mfaEnrollmentGrants.usedAt),
        isNull(mfaEnrollmentGrants.supersededAt),
        /*
         * Poređenje ide kroz `gt`, ne kroz sirov `sql` šablon.
         *
         * U šablonu vrednost putuje do drajvera bez tipa kolone, pa `Date`
         * stigne kao objekat koji drajver ne ume da serijalizuje
         * (`ERR_INVALID_ARG_TYPE`). Operator `gt` prolazi kroz maper kolone i
         * šalje ispravan `timestamptz`.
         */
        gt(mfaEnrollmentGrants.expiresAt, now),
      ),
    )
    .limit(1);
  return rows.length === 1;
}

/**
 * Aktivan `gazda` po e-pošti — za bootstrap iz komandne linije.
 *
 * Namerno ne prima proizvoljnu ulogu: prvi drugi faktor u sistemu mora biti
 * vlasnikov.
 */
export async function findActiveOwnerByEmail(email: string) {
  const rows = await getDb()
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.email, email.trim().toLowerCase()),
        eq(users.role, "gazda"),
        eq(users.active, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
