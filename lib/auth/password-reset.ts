import "server-only";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { passwordResetCodes, users } from "@/db/schema";
import {
  activeKeyVersion,
  recoveryCodeFingerprint,
} from "@/lib/auth/mfa-crypto.mjs";
import { hashPassword } from "@/lib/auth/password.mjs";
import {
  generateRecoveryCode,
  looksLikeRecoveryCode,
} from "@/lib/auth/recovery-codes.mjs";
import type { Tx } from "@/lib/authz/security-admin";

/**
 * Kod za promenu lozinke koji vlasnik izdaje zaposlenom.
 *
 * Namena
 * ------
 * Čovek je zaboravio lozinku ili je nalog kompromitovan. Nema slanja e-pošte:
 * poruka u sandučetu je kopija koja živi na tuđem serveru i u tuđem kešu, a
 * poštanski nalog je čest prvi cilj napada. Vlasnik izdaje kod uživo ili
 * telefonom, i kod važi kratko.
 *
 * Oblik i čuvanje
 * ---------------
 * Isti generator kao rezervni kodovi: ~147 bita entropije, znatno iznad
 * traženih 128. Čuva se **isključivo** kao HMAC otisak sa razdvojenim ključem —
 * ni ispis baze ni rezervna kopija ne daju upotrebljiv kod.
 *
 * Kod nikada ne ide u adresu. Adresa završi u istoriji pretraživača, u logu
 * posrednika i u `Referer` zaglavlju sledećeg zahteva; jednokratna tajna tamo
 * prestaje da bude jednokratna.
 */

/** Kratak rok: kod se izdaje uživo i koristi odmah. */
export const RESET_TTL_MS = 30 * 60_000;

function env() {
  return {
    PORTAL_MFA_MASTER_KEY_V1: process.env.PORTAL_MFA_MASTER_KEY_V1,
    PORTAL_MFA_MASTER_KEY_V2: process.env.PORTAL_MFA_MASTER_KEY_V2,
    PORTAL_MFA_ACTIVE_KEY_VERSION: process.env.PORTAL_MFA_ACTIVE_KEY_VERSION,
  };
}

/**
 * Izdaje kod i vraća ga u čitljivom obliku — jedini put kada postoji.
 *
 * Prethodni neiskorišćeni kodovi istog korisnika se poništavaju: u svakom
 * trenutku sme da važi najviše jedan, pa zaboravljeni stari ne ostaje kao
 * otvorena vrata.
 *
 * Izdavanje odmah povećava `session_version` cilja. Razlog: kod se izdaje jer
 * je pristup izgubljen ili ugrožen — tuđa otvorena sesija ne sme da preživi tu
 * odluku i čeka da neko stigne da promeni lozinku.
 *
 * @param tx opciona spoljna transakcija; audit i izdavanje moraju biti zajedno
 */
export async function issuePasswordResetCode(input: {
  userId: string;
  issuedBy: string | null;
  now?: Date;
  tx?: Tx;
}): Promise<{ code: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS);
  const code = generateRecoveryCode();
  const keyVersion = activeKeyVersion(env());

  const run = async (tx: Tx) => {
    await tx
      .update(passwordResetCodes)
      .set({ supersededAt: now })
      .where(
        and(
          eq(passwordResetCodes.userId, input.userId),
          isNull(passwordResetCodes.usedAt),
          isNull(passwordResetCodes.supersededAt),
        ),
      );

    await tx.insert(passwordResetCodes).values({
      userId: input.userId,
      codeFingerprint: recoveryCodeFingerprint(code, env(), keyVersion),
      keyVersion,
      issuedBy: input.issuedBy,
      expiresAt,
      createdAt: now,
    });

    // Otvorene sesije padaju odmah, ne tek kada se lozinka promeni.
    await tx
      .update(users)
      .set({ sessionVersion: sql`${users.sessionVersion} + 1`, updatedAt: now })
      .where(eq(users.id, input.userId));
  };

  if (input.tx) await run(input.tx);
  else await getDb().transaction(run);

  return { code, expiresAt };
}

/** Ishod pokušaja promene lozinke kodom. */
export type ResetOutcome =
  | { ok: true; userId: string; email: string; name: string; role: string }
  | { ok: false };

/**
 * Menja lozinku uz važeći kod.
 *
 * Svi uslovi su u `WHERE`, ne u JavaScript-u: pravi korisnik, neiskorišćen,
 * neponišten i još važeći kod. Dva paralelna pokušaja sa istim kodom nalaze
 * isti red, ali samo jedan ga označi kao iskorišćen — drugi vidi nula redova i
 * pada. Provera u kodu pa upis bila bi trka u kojoj bi oba prošla.
 *
 * Traži se i e-pošta: sam otisak koda bi bio dovoljan da se pogodi red, ali
 * vezivanje za nalog znači da presretnut kod ne otvara tuđi nalog čak ni kada
 * napadač zna da kod postoji.
 *
 * Nova lozinka i `session_version` menjaju se u istoj transakciji kao i
 * trošenje koda — ne postoji trenutak u kome je kod potrošen a lozinka stara.
 */
export async function completePasswordReset(input: {
  email: string;
  code: string;
  newPassword: string;
  now?: Date;
}): Promise<ResetOutcome> {
  /*
   * Oblik koda otpada odmah.
   *
   * Ovo NE odaje da li nalog postoji — odgovor zavisi samo od onoga što je
   * napadač sam poslao. Zato sme pre skupog posla.
   */
  if (!looksLikeRecoveryCode(input.code)) return { ok: false };

  const now = input.now ?? new Date();
  const email = input.email.trim().toLowerCase();

  const [account] = await getDb()
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  /*
   * Lozinka se heši UVEK, pre ijedne odluke o nalogu.
   *
   * scrypt traje oko 100 ms i mora se pojaviti u obe grane.
   */
  const passwordHash = await hashPassword(input.newPassword);

  /*
   * Odavde nadalje obe grane rade ISTI POSAO.
   *
   * Prvo merenje nad pravom bazom pokazalo je 604 ms za postojeći nalog i 160 ms
   * za nepostojeći — razlika od 443 ms, sasvim dovoljna da obrazac za oporavak
   * postane sredstvo za proveru koje adrese postoje. Uzrok nije bio heš (on je
   * već bio u obe grane) nego to što je grana bez naloga izlazila PRE
   * transakcije, pre računanja otisaka i pre upita — dakle pre svih mrežnih
   * obrtaja ka bazi, koji nad udaljenim Postgresom dominiraju vremenom.
   *
   * Zato se ovde ne izlazi ranije. Umesto naloga koji ne postoji koristi se
   * ID koji ne može nikoga da pogodi, pa upit radi isti posao i vraća nula
   * redova. Rezultat je isti broj obrtaja i isti kriptografski rad u obe grane.
   *
   * Namerno NIJE upotrebljen fiksni `sleep`: on izjednačava prosek, ali ne i
   * oblik raspodele, a i dalje kažnjava svakog poštenog korisnika.
   */
  const NEPOSTOJECI_ID = "00000000-0000-0000-0000-000000000000";
  const dozvoljen = Boolean(account && account.active);
  const targetId = dozvoljen ? account!.id : NEPOSTOJECI_ID;

  return getDb().transaction(async (tx) => {
    let consumed = false;

    /*
     * Otisak se traži po SVIM verzijama ključa koje sistem poznaje.
     *
     * Kod izdat pre rotacije ključa mora i dalje da radi do isteka; inače bi
     * rotacija tiho oborila sve kodove u opticaju.
     *
     * Petlja se izvršava do kraja i kada nalog ne postoji — svaka verzija znači
     * jedan HMAC i jedan obrtaj ka bazi, i ti moraju biti isti u obe grane.
     */
    for (const keyVersion of knownKeyVersions()) {
      const fingerprint = recoveryCodeFingerprint(input.code, env(), keyVersion);
      const rows = await tx
        .update(passwordResetCodes)
        .set({ usedAt: now })
        .where(
          and(
            eq(passwordResetCodes.codeFingerprint, fingerprint),
            eq(passwordResetCodes.userId, targetId),
            isNull(passwordResetCodes.usedAt),
            isNull(passwordResetCodes.supersededAt),
            gt(passwordResetCodes.expiresAt, now),
          ),
        )
        .returning({ id: passwordResetCodes.id });

      if (rows.length === 1) {
        consumed = true;
        break;
      }
    }

    /*
     * Poslednji upis takođe ide u obe grane.
     *
     * Kada nema šta da se promeni, `WHERE` gađa isti nepostojeći ID i pogađa
     * nula redova. Broj obrtaja ostaje isti, a nijedan red se ne dira.
     */
    await tx
      .update(users)
      .set({
        passwordHash,
        // Sve sesije padaju: ko je promenio lozinku očekuje da tuđa ne radi.
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: now,
      })
      .where(eq(users.id, consumed && dozvoljen ? targetId : NEPOSTOJECI_ID));

    if (!consumed || !dozvoljen) return { ok: false } as ResetOutcome;

    return {
      ok: true,
      userId: account!.id,
      email: account!.email,
      name: account!.name,
      role: account!.role,
    } as ResetOutcome;
  });
}

/**
 * Verzije ključa koje sistem poznaje, od aktivne ka starijoj.
 *
 * Redosled je bitan samo za brzinu: aktivna pogađa u prvom prolazu u gotovo
 * svim slučajevima.
 */
function knownKeyVersions(): number[] {
  const active = activeKeyVersion(env());
  const all = new Set<number>([active]);
  if (process.env.PORTAL_MFA_MASTER_KEY_V1) all.add(1);
  if (process.env.PORTAL_MFA_MASTER_KEY_V2) all.add(2);
  return [active, ...[...all].filter((v) => v !== active)];
}

/** Da li korisnik ima kod koji još važi — za prikaz u administraciji. */
export async function hasOpenResetCode(userId: string, now = new Date()) {
  const [row] = await getDb()
    .select({ id: passwordResetCodes.id })
    .from(passwordResetCodes)
    .where(
      and(
        eq(passwordResetCodes.userId, userId),
        isNull(passwordResetCodes.usedAt),
        isNull(passwordResetCodes.supersededAt),
        gt(passwordResetCodes.expiresAt, now),
      ),
    )
    .limit(1);
  return Boolean(row);
}
