import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { mfaRecoveryCodes, userMfa } from "@/db/schema";
import {
  activeKeyVersion,
  decryptMfaSecret,
  encryptMfaSecret,
  isMfaConfigured,
  recoveryCodeFingerprint,
} from "@/lib/auth/mfa-crypto.mjs";
import {
  generateRecoveryCodes,
  looksLikeRecoveryCode,
} from "@/lib/auth/recovery-codes.mjs";
import {
  generateTotpSecret,
  isCounterFresh,
  totpUri,
  verifyTotp,
} from "@/lib/auth/totp.mjs";

/**
 * MFA nad bazom.
 *
 * Ovde su dve garancije koje se ne mogu izraziti čistom logikom, jer zavise od
 * toga šta radi drugi zahtev u istom trenutku:
 *
 *   1. isti TOTP kod ne prolazi dvaput — uslov je u `WHERE`, ne u aplikaciji;
 *   2. recovery kod se troši jednom — `UPDATE … WHERE used_at IS NULL`.
 *
 * U oba slučaja odluku donosi Postgres, a aplikacija samo gleda koliko je redova
 * promenjeno. Provera pa upis iz aplikacije bi propustila obe.
 */

/** Napušten enrollment ne sme da važi zauvek. */
const PENDING_TTL_MS = 10 * 60_000;

function env() {
  return {
    PORTAL_MFA_MASTER_KEY_V1: process.env.PORTAL_MFA_MASTER_KEY_V1,
    PORTAL_MFA_MASTER_KEY_V2: process.env.PORTAL_MFA_MASTER_KEY_V2,
    PORTAL_MFA_ACTIVE_KEY_VERSION: process.env.PORTAL_MFA_ACTIVE_KEY_VERSION,
  };
}

export type MfaStatus = {
  enabled: boolean;
  enrolledAt: Date | null;
  pendingUntil: Date | null;
  unusedRecoveryCodes: number;
};

export async function readMfaStatus(userId: string): Promise<MfaStatus> {
  const db = getDb();
  const [row] = await db
    .select({
      secretCiphertext: userMfa.secretCiphertext,
      enrolledAt: userMfa.enrolledAt,
      pendingExpiresAt: userMfa.pendingExpiresAt,
      pendingCiphertext: userMfa.pendingCiphertext,
    })
    .from(userMfa)
    .where(eq(userMfa.userId, userId))
    .limit(1);

  const [counts] = await db
    .select({ remaining: sql<number>`count(*)::int` })
    .from(mfaRecoveryCodes)
    .where(
      and(eq(mfaRecoveryCodes.userId, userId), isNull(mfaRecoveryCodes.usedAt)),
    );

  return {
    enabled: Boolean(row?.secretCiphertext),
    enrolledAt: row?.enrolledAt ?? null,
    pendingUntil: row?.pendingCiphertext ? row?.pendingExpiresAt ?? null : null,
    unusedRecoveryCodes: counts?.remaining ?? 0,
  };
}

/**
 * Započinje vezivanje: pravi tajnu i odmah je čuva šifrovanu.
 *
 * Tajna se ne drži u sesiji ni u skrivenom polju obrasca — jedini prolaz kroz
 * aplikaciju je ovaj povratni objekat, koji se prikazuje jednom i ne beleži.
 *
 * MFA se NE aktivira ovde. Aktivira se tek kada korisnik dokaže da je tajnu
 * uspešno uneo u aplikaciju — inače bi zaključavanje naloga bilo trivijalno.
 */
export async function beginMfaEnrollment(input: {
  userId: string;
  accountLabel: string;
  now?: Date;
}): Promise<{ base32: string; uri: string; expiresAt: Date }> {
  if (!isMfaConfigured(env())) {
    throw new Error("MFA nije podešen: nedostaje master ključ.");
  }

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + PENDING_TTL_MS);
  const { bytes, base32 } = generateTotpSecret();
  const encrypted = encryptMfaSecret(bytes, env());

  // Ponovno pokretanje zamenjuje prethodni nezavršen pokušaj — korisnik koji je
  // pogrešio pri prepisivanju ne ostaje zaglavljen.
  await getDb()
    .insert(userMfa)
    .values({
      userId: input.userId,
      pendingCiphertext: encrypted.ciphertext,
      pendingIv: encrypted.iv,
      pendingAuthTag: encrypted.authTag,
      pendingKeyVersion: encrypted.keyVersion,
      pendingExpiresAt: expiresAt,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userMfa.userId,
      set: {
        pendingCiphertext: encrypted.ciphertext,
        pendingIv: encrypted.iv,
        pendingAuthTag: encrypted.authTag,
        pendingKeyVersion: encrypted.keyVersion,
        pendingExpiresAt: expiresAt,
        updatedAt: now,
      },
    });

  return {
    base32,
    uri: totpUri(bytes, input.accountLabel),
    expiresAt,
  };
}

/**
 * Potvrđuje vezivanje prvim ispravnim kodom i aktivira MFA.
 *
 * Vraća recovery kodove — jedini put kada ih iko vidi.
 */
export async function confirmMfaEnrollment(input: {
  userId: string;
  token: string;
  now?: Date;
}): Promise<{ ok: boolean; recoveryCodes: string[] }> {
  const now = input.now ?? new Date();
  const db = getDb();

  const [row] = await db
    .select({
      pendingCiphertext: userMfa.pendingCiphertext,
      pendingIv: userMfa.pendingIv,
      pendingAuthTag: userMfa.pendingAuthTag,
      pendingKeyVersion: userMfa.pendingKeyVersion,
      pendingExpiresAt: userMfa.pendingExpiresAt,
    })
    .from(userMfa)
    .where(eq(userMfa.userId, input.userId))
    .limit(1);

  if (!row?.pendingCiphertext || !row.pendingExpiresAt) {
    return { ok: false, recoveryCodes: [] };
  }
  if (row.pendingExpiresAt <= now) return { ok: false, recoveryCodes: [] };

  const secret = decryptMfaSecret(
    {
      ciphertext: row.pendingCiphertext,
      iv: row.pendingIv!,
      authTag: row.pendingAuthTag!,
      keyVersion: row.pendingKeyVersion!,
    },
    env(),
  );

  const result = verifyTotp({ secretBytes: secret, token: input.token, now });
  if (!result.valid || result.counter === null) {
    return { ok: false, recoveryCodes: [] };
  }

  const codes = generateRecoveryCodes();
  const version = activeKeyVersion(env());

  await db.transaction(async (tx) => {
    // Tajna prelazi iz „u toku" u aktivnu; `lastAcceptedCounter` se odmah
    // postavlja da kod upotrebljen za potvrdu ne prođe i pri prijavi.
    await tx
      .update(userMfa)
      .set({
        secretCiphertext: row.pendingCiphertext,
        secretIv: row.pendingIv,
        secretAuthTag: row.pendingAuthTag,
        secretKeyVersion: row.pendingKeyVersion,
        enrolledAt: now,
        lastAcceptedCounter: result.counter,
        pendingCiphertext: null,
        pendingIv: null,
        pendingAuthTag: null,
        pendingKeyVersion: null,
        pendingExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(userMfa.userId, input.userId));

    await replaceRecoveryCodes(tx, input.userId, codes, version, now);
  });

  return { ok: true, recoveryCodes: codes };
}

/**
 * Provera TOTP koda pri prijavi ili osetljivoj radnji.
 *
 * Zaštita od ponovne upotrebe je u `WHERE` uslovu: prozor mora biti strogo veći
 * od poslednjeg prihvaćenog. Dva paralelna zahteva sa istim kodom čitaju isto
 * stanje, ali samo jedan `UPDATE` menja red — drugi vidi nula izmenjenih redova
 * i pada.
 */
export async function verifyTotpForUser(input: {
  userId: string;
  token: string;
  now?: Date;
}): Promise<boolean> {
  const now = input.now ?? new Date();
  const db = getDb();

  const [row] = await db
    .select({
      secretCiphertext: userMfa.secretCiphertext,
      secretIv: userMfa.secretIv,
      secretAuthTag: userMfa.secretAuthTag,
      secretKeyVersion: userMfa.secretKeyVersion,
      lastAcceptedCounter: userMfa.lastAcceptedCounter,
    })
    .from(userMfa)
    .where(eq(userMfa.userId, input.userId))
    .limit(1);

  if (!row?.secretCiphertext) return false;

  let secret: Buffer;
  try {
    secret = decryptMfaSecret(
      {
        ciphertext: row.secretCiphertext,
        iv: row.secretIv!,
        authTag: row.secretAuthTag!,
        keyVersion: row.secretKeyVersion!,
      },
      env(),
    );
  } catch {
    // Neispravan zapis se ponaša kao pogrešan kod — iz odgovora se ne sme
    // zaključiti da je zapis oštećen.
    return false;
  }

  const result = verifyTotp({ secretBytes: secret, token: input.token, now });
  if (!result.valid || result.counter === null) return false;

  // Rana provera štedi upit; prava odluka je i dalje u bazi.
  if (!isCounterFresh(result.counter, row.lastAcceptedCounter)) return false;

  const updated = await db
    .update(userMfa)
    .set({ lastAcceptedCounter: result.counter, updatedAt: now })
    .where(
      and(
        eq(userMfa.userId, input.userId),
        // Ovo je brava: samo jedan od dva paralelna zahteva zadovoljava uslov.
        sql`(${userMfa.lastAcceptedCounter} IS NULL OR ${userMfa.lastAcceptedCounter} < ${result.counter})`,
      ),
    )
    .returning({ userId: userMfa.userId });

  return updated.length === 1;
}

/**
 * Troši recovery kod.
 *
 * `WHERE used_at IS NULL` je jedina garancija jednokratnosti: dva paralelna
 * pokušaja sa istim kodom oba nađu red, ali samo jedan ga označi kao
 * iskorišćen.
 */
export async function consumeRecoveryCode(input: {
  userId: string;
  code: string;
  now?: Date;
}): Promise<boolean> {
  if (!looksLikeRecoveryCode(input.code)) return false;

  const now = input.now ?? new Date();
  const fingerprint = recoveryCodeFingerprint(input.code, env());

  const consumed = await getDb()
    .update(mfaRecoveryCodes)
    .set({ usedAt: now })
    .where(
      and(
        eq(mfaRecoveryCodes.userId, input.userId),
        eq(mfaRecoveryCodes.codeFingerprint, fingerprint),
        isNull(mfaRecoveryCodes.usedAt),
      ),
    )
    .returning({ id: mfaRecoveryCodes.id });

  return consumed.length === 1;
}

/**
 * Nov set kodova; prethodni prestaje da važi.
 */
export async function regenerateRecoveryCodes(input: {
  userId: string;
  now?: Date;
}): Promise<string[]> {
  const now = input.now ?? new Date();
  const codes = generateRecoveryCodes();
  const version = activeKeyVersion(env());

  await getDb().transaction(async (tx) => {
    await replaceRecoveryCodes(tx, input.userId, codes, version, now);
  });

  return codes;
}

/**
 * Poništava MFA: briše tajnu i sve kodove.
 *
 * Koristi se kada vlasnik resetuje tuđi izgubljeni authenticator. Stara tajna i
 * stari kodovi posle ovoga ne rade — korisnik mora ponovo proći vezivanje.
 *
 * Ne briše red iz `user_mfa`: `enrolled_at` i `updated_at` ostaju trag da je MFA
 * postojao i kada je uklonjen.
 */
export async function resetMfaForUser(input: {
  userId: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();

  await getDb().transaction(async (tx) => {
    await tx
      .update(userMfa)
      .set({
        secretCiphertext: null,
        secretIv: null,
        secretAuthTag: null,
        secretKeyVersion: null,
        enrolledAt: null,
        lastAcceptedCounter: null,
        pendingCiphertext: null,
        pendingIv: null,
        pendingAuthTag: null,
        pendingKeyVersion: null,
        pendingExpiresAt: null,
        updatedAt: now,
      })
      .where(eq(userMfa.userId, input.userId));

    await tx
      .delete(mfaRecoveryCodes)
      .where(eq(mfaRecoveryCodes.userId, input.userId));
  });
}

/** Zamena celog seta kodova, unutar postojeće transakcije. */
async function replaceRecoveryCodes(
  tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0],
  userId: string,
  codes: readonly string[],
  keyVersion: number,
  now: Date,
) {
  // Stari set se briše, ne označava kao iskorišćen: „iskorišćen" bi lagalo da
  // je neko od tih kodova upotrebljen.
  await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));

  const [{ batch } = { batch: 1 }] = await tx
    .select({ batch: sql<number>`coalesce(max(${mfaRecoveryCodes.batch}), 0) + 1` })
    .from(mfaRecoveryCodes)
    .where(eq(mfaRecoveryCodes.userId, userId));

  await tx.insert(mfaRecoveryCodes).values(
    codes.map((code) => ({
      userId,
      codeFingerprint: recoveryCodeFingerprint(code, env(), keyVersion),
      keyVersion,
      batch,
      createdAt: now,
    })),
  );
}
