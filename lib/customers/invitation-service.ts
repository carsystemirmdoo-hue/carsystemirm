import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  customerAccountTokens,
  customerMessageOutbox,
  customerUsers,
  type CustomerTokenPurpose,
} from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import {
  activeKeyVersion,
  recoveryCodeFingerprint,
} from "@/lib/auth/mfa-crypto.mjs";
import { hashPassword } from "@/lib/auth/password.mjs";
import {
  generateRecoveryCode,
  looksLikeRecoveryCode,
} from "@/lib/auth/recovery-codes.mjs";
import { CustomerAccountError, type AccountActor } from "@/lib/customers/account-service";

/**
 * Pozivnica i reset lozinke kupčevog naloga.
 *
 * Namerno koristi ISTI obrazac kao `lib/auth/enrollment-grant.ts`: token iste
 * entropije (~147 bita), čuvan isključivo kao HMAC otisak, jednokratan, sa
 * rokom, i sa poništavanjem prethodnih otvorenih tokena iste svrhe. Drugi
 * obrazac za istu potrebu značio bi dva mesta na kojima se greši nezavisno.
 *
 * Token NIGDE ne ulazi u trag revizije, obaveštenje, outbox ni dnevnik. Postoji
 * tačno jednom — u povratnoj vrednosti radnje koja ga je izdala.
 */

/** Poziv se šalje i čeka čoveka; reset se traži i koristi odmah. */
const INVITATION_TTL_MS = 48 * 60 * 60_000;
const RESET_TTL_MS = 60 * 60_000;

export const TOKEN_TTL_MS: Record<CustomerTokenPurpose, number> = {
  invitation: INVITATION_TTL_MS,
  password_reset: RESET_TTL_MS,
};

/** Najmanja dužina lozinke koju kupac sam postavlja. */
export const CUSTOMER_PASSWORD_MIN = 12;

function env() {
  return {
    PORTAL_MFA_MASTER_KEY_V1: process.env.PORTAL_MFA_MASTER_KEY_V1,
    PORTAL_MFA_MASTER_KEY_V2: process.env.PORTAL_MFA_MASTER_KEY_V2,
    PORTAL_MFA_ACTIVE_KEY_VERSION: process.env.PORTAL_MFA_ACTIVE_KEY_VERSION,
  };
}

/**
 * Izdaje token i vraća ga u čitljivom obliku — jedini put kada postoji.
 *
 * Prethodni otvoreni tokeni iste svrhe se poništavaju u istoj transakciji.
 */
async function issueToken(input: {
  customerUserId: string;
  purpose: CustomerTokenPurpose;
  issuedBy: string | null;
  now?: Date;
}): Promise<{ token: string; expiresAt: Date }> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS[input.purpose]);
  const token = generateRecoveryCode();
  const keyVersion = activeKeyVersion(env());

  await getDb().transaction(async (tx) => {
    await tx
      .update(customerAccountTokens)
      .set({ supersededAt: now })
      .where(
        and(
          eq(customerAccountTokens.customerUserId, input.customerUserId),
          eq(customerAccountTokens.purpose, input.purpose),
          isNull(customerAccountTokens.usedAt),
          isNull(customerAccountTokens.supersededAt),
        ),
      );

    await tx.insert(customerAccountTokens).values({
      customerUserId: input.customerUserId,
      purpose: input.purpose,
      tokenFingerprint: recoveryCodeFingerprint(token, env(), keyVersion),
      keyVersion,
      issuedBy: input.issuedBy,
      expiresAt,
      createdAt: now,
    });
  });

  return { token, expiresAt };
}

/**
 * Troši token.
 *
 * Svi uslovi su u `WHERE`: prava svrha, neiskorišćen, neponišten i još važeći.
 * Dva paralelna pokušaja istim tokenom pogađaju isti red, ali samo jedan ga
 * označi kao iskorišćen — drugi vidi nula redova i pada.
 *
 * Vraća ID naloga ili `null`. Nikada ne kaže ZAŠTO je pao: istekao, iskorišćen
 * i nepostojeći token spolja izgledaju isto.
 */
async function consumeToken(input: {
  token: string;
  purpose: CustomerTokenPurpose;
  now?: Date;
}): Promise<string | null> {
  if (!looksLikeRecoveryCode(input.token)) return null;
  const now = input.now ?? new Date();

  const consumed = await getDb()
    .update(customerAccountTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(
          customerAccountTokens.tokenFingerprint,
          recoveryCodeFingerprint(input.token, env()),
        ),
        eq(customerAccountTokens.purpose, input.purpose),
        isNull(customerAccountTokens.usedAt),
        isNull(customerAccountTokens.supersededAt),
        // `gt` prolazi kroz maper kolone i šalje ispravan `timestamptz`.
        gt(customerAccountTokens.expiresAt, now),
      ),
    )
    .returning({ customerUserId: customerAccountTokens.customerUserId });

  return consumed[0]?.customerUserId ?? null;
}

/* =========================================================================
 * Pozivnica
 * ====================================================================== */

/**
 * Odobrava nalog i izdaje pozivnicu.
 *
 * Kancelarija NE unosi lozinku. Nalog prelazi u `approved` bez `password_hash`
 * (baza to sprovodi kroz `customer_users_password_lifecycle_ck`), a kupac sam
 * postavlja lozinku kada iskoristi token.
 *
 * Link se vraća pozivaocu TAČNO JEDNOM. Outbox red beleži da poruku treba
 * poslati, ali token ne sadrži.
 */
export async function issueInvitation(
  input: { accountId: string; reason: string },
  actor: AccountActor,
): Promise<{ token: string; expiresAt: Date }> {
  const reason = input.reason.trim();
  if (reason.length < 3) {
    throw new CustomerAccountError(
      "Izdavanje poziva traži razlog (najmanje 3 znaka).",
      "missing_reason",
    );
  }

  const db = getDb();
  const [account] = await db
    .select({
      id: customerUsers.id,
      email: customerUsers.email,
      status: customerUsers.status,
    })
    .from(customerUsers)
    .where(eq(customerUsers.id, input.accountId))
    .limit(1);

  if (!account) throw new CustomerAccountError("Nalog ne postoji.", "not_found");
  if (account.status === "rejected" || account.status === "suspended") {
    throw new CustomerAccountError(
      "Nalog je odbijen ili isključen — poziv se ne izdaje dok se to ne promeni.",
      "bad_status",
    );
  }

  const issued = await issueToken({
    customerUserId: account.id,
    purpose: "invitation",
    issuedBy: actor.id,
  });

  const correlationId = randomUUID();

  await db.transaction(async (tx) => {
    /*
     * Odobrenje briše eventualnu zatečenu lozinku.
     *
     * Ako je nalog nekada imao lozinku koju je postavio neko drugi, novi poziv
     * je poništava — pristup se otvara samo onome ko iskoristi token.
     */
    await tx
      .update(customerUsers)
      .set({
        status: "approved",
        passwordHash: null,
        decidedBy: actor.id,
        decidedAt: sql`now()`,
        decisionReason: reason,
        sessionVersion: sql`${customerUsers.sessionVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(customerUsers.id, account.id));

    await tx.insert(customerMessageOutbox).values({
      customerUserId: account.id,
      kind: "invitation",
    });

    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.customerInvitationIssued,
        entityType: "Kupčev nalog",
        entityId: account.id,
        entityLabel: account.email,
        before: { status: account.status },
        // Token NIKADA ne ide u trag — beleži se da je izdat, ne koji.
        after: { status: "approved", pozivIzdat: true },
        reason,
        correlationId,
      },
      tx,
    );
  });

  return issued;
}

/**
 * Aktivacija: kupac troši token i postavlja SVOJU lozinku.
 *
 * Uspeh troši token, prevodi nalog u `active` i povećava `sessionVersion` —
 * sve u jednoj transakciji. Poslednje je bitno i kod prve aktivacije: ako je
 * neko ranije držao token iste sesije, on posle ovoga ne važi.
 */
export async function activateWithInvitation(input: {
  token: string;
  password: string;
}): Promise<{ ok: boolean }> {
  if (input.password.length < CUSTOMER_PASSWORD_MIN) {
    throw new CustomerAccountError(
      `Lozinka mora imati najmanje ${CUSTOMER_PASSWORD_MIN} znakova.`,
      "weak_password",
    );
  }

  const accountId = await consumeToken({
    token: input.token,
    purpose: "invitation",
  });
  if (!accountId) return { ok: false };

  const passwordHash = await hashPassword(input.password);
  const db = getDb();

  const [account] = await db
    .select({ id: customerUsers.id, email: customerUsers.email })
    .from(customerUsers)
    .where(eq(customerUsers.id, accountId))
    .limit(1);
  if (!account) return { ok: false };

  await db.transaction(async (tx) => {
    await tx
      .update(customerUsers)
      .set({
        status: "active",
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessionVersion: sql`${customerUsers.sessionVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(customerUsers.id, accountId));

    await recordAudit(
      {
        actor: { id: null, name: account.email, role: "kupac" },
        action: AUDIT_ACTIONS.customerAccountActivated,
        entityType: "Kupčev nalog",
        entityId: accountId,
        entityLabel: account.email,
        before: { status: "approved" },
        after: { status: "active" },
        reason: "Kupac aktivirao nalog pozivnim tokenom i postavio lozinku.",
        correlationId: randomUUID(),
      },
      tx,
    );
  });

  return { ok: true };
}

/* =========================================================================
 * Reset lozinke
 * ====================================================================== */

/**
 * „Zaboravljena lozinka".
 *
 * Vraća `void` bez obzira na ishod, i pozivalac uvek prikazuje istu poruku.
 * Razlika u odgovoru za postojeću i nepostojeću adresu je enumeracija naloga —
 * spisak kupaca jedne firme je poslovno osetljiv podatak.
 *
 * Vraćeni token postoji samo kada nalog stvarno postoji i sme da se prijavi;
 * pozivalac ga NE sme proslediti u odgovor korisniku, nego u outbox tok.
 */
export async function requestPasswordReset(input: {
  email: string;
}): Promise<{ token: string; accountId: string } | null> {
  const email = input.email.trim().toLowerCase();
  const db = getDb();

  const [account] = await db
    .select({
      id: customerUsers.id,
      email: customerUsers.email,
      status: customerUsers.status,
    })
    .from(customerUsers)
    .where(eq(customerUsers.email, email))
    .limit(1);

  // Reset ima smisla samo za nalog koji je već aktiviran.
  if (!account || account.status !== "active") return null;

  const issued = await issueToken({
    customerUserId: account.id,
    purpose: "password_reset",
    issuedBy: null,
  });

  await db.transaction(async (tx) => {
    await tx.insert(customerMessageOutbox).values({
      customerUserId: account.id,
      kind: "password_reset",
    });
    await recordAudit(
      {
        actor: { id: null, name: account.email, role: "kupac" },
        action: AUDIT_ACTIONS.customerPasswordResetIssued,
        entityType: "Kupčev nalog",
        entityId: account.id,
        entityLabel: account.email,
        reason: "Kupac zatražio promenu lozinke.",
        correlationId: randomUUID(),
      },
      tx,
    );
  });

  return { token: issued.token, accountId: account.id };
}

/** Troši reset token, postavlja novu lozinku i obara sve postojeće sesije. */
export async function completePasswordReset(input: {
  token: string;
  password: string;
}): Promise<{ ok: boolean }> {
  if (input.password.length < CUSTOMER_PASSWORD_MIN) {
    throw new CustomerAccountError(
      `Lozinka mora imati najmanje ${CUSTOMER_PASSWORD_MIN} znakova.`,
      "weak_password",
    );
  }

  const accountId = await consumeToken({
    token: input.token,
    purpose: "password_reset",
  });
  if (!accountId) return { ok: false };

  const passwordHash = await hashPassword(input.password);
  const db = getDb();
  const [account] = await db
    .select({ email: customerUsers.email })
    .from(customerUsers)
    .where(eq(customerUsers.id, accountId))
    .limit(1);
  if (!account) return { ok: false };

  await db.transaction(async (tx) => {
    await tx
      .update(customerUsers)
      .set({
        passwordHash,
        status: "active",
        failedLoginAttempts: 0,
        lockedUntil: null,
        sessionVersion: sql`${customerUsers.sessionVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(customerUsers.id, accountId));

    await recordAudit(
      {
        actor: { id: null, name: account.email, role: "kupac" },
        action: AUDIT_ACTIONS.customerPasswordResetCompleted,
        entityType: "Kupčev nalog",
        entityId: accountId,
        entityLabel: account.email,
        reason: "Lozinka promenjena reset tokenom; sve sesije opozvane.",
        correlationId: randomUUID(),
      },
      tx,
    );
  });

  return { ok: true };
}

/**
 * Promena lozinke iz aktivne kupčeve sesije.
 *
 * Traži staru lozinku: sesija u tuđim rukama ne sme moći da zameni lozinku i
 * time trajno preuzme nalog.
 */
export async function changeCustomerPassword(input: {
  accountId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean }> {
  if (input.newPassword.length < CUSTOMER_PASSWORD_MIN) {
    throw new CustomerAccountError(
      `Lozinka mora imati najmanje ${CUSTOMER_PASSWORD_MIN} znakova.`,
      "weak_password",
    );
  }

  const { verifyPassword } = await import("@/lib/auth/password.mjs");
  const db = getDb();
  const [account] = await db
    .select({
      id: customerUsers.id,
      email: customerUsers.email,
      passwordHash: customerUsers.passwordHash,
    })
    .from(customerUsers)
    .where(eq(customerUsers.id, input.accountId))
    .limit(1);

  if (!account?.passwordHash) return { ok: false };
  if (!(await verifyPassword(input.currentPassword, account.passwordHash))) {
    return { ok: false };
  }

  const passwordHash = await hashPassword(input.newPassword);

  await db.transaction(async (tx) => {
    await tx
      .update(customerUsers)
      .set({
        passwordHash,
        sessionVersion: sql`${customerUsers.sessionVersion} + 1`,
        updatedAt: sql`now()`,
      })
      .where(eq(customerUsers.id, input.accountId));

    await recordAudit(
      {
        actor: { id: null, name: account.email, role: "kupac" },
        action: AUDIT_ACTIONS.customerPasswordChanged,
        entityType: "Kupčev nalog",
        entityId: account.id,
        entityLabel: account.email,
        reason: "Kupac promenio lozinku; sve sesije opozvane.",
        correlationId: randomUUID(),
      },
      tx,
    );
  });

  return { ok: true };
}

/** Outbox stavke koje čekaju da ih neko isporuči. */
export async function listPendingOutbox() {
  const db = getDb();
  return db
    .select({
      id: customerMessageOutbox.id,
      kind: customerMessageOutbox.kind,
      status: customerMessageOutbox.status,
      createdAt: customerMessageOutbox.createdAt,
      email: customerUsers.email,
      accountId: customerUsers.id,
    })
    .from(customerMessageOutbox)
    .innerJoin(
      customerUsers,
      eq(customerUsers.id, customerMessageOutbox.customerUserId),
    )
    .where(eq(customerMessageOutbox.status, "pending"))
    .limit(200);
}

/** Kancelarija je preuzela link i predaje ga van sistema. */
export async function markOutboxHandedOver(
  id: number,
  actor: AccountActor,
): Promise<boolean> {
  const rows = await getDb()
    .update(customerMessageOutbox)
    .set({
      status: "handed_over",
      handedOverAt: sql`now()`,
      handedOverBy: actor.id,
    })
    .where(
      and(
        eq(customerMessageOutbox.id, id),
        eq(customerMessageOutbox.status, "pending"),
      ),
    )
    .returning({ id: customerMessageOutbox.id });
  return rows.length === 1;
}
