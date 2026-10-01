import { eq, sql } from "drizzle-orm";
import { consumeRememberGrant } from "./lib/auth/remember-tokens";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getDb } from "./db/client";
import { users } from "./db/schema";
import {
  ABSENT_USER_PASSWORD_RECORD,
  verifyPassword,
} from "./lib/auth/password.mjs";
import {
  resolveCredentialsLogin,
  shouldCountFailedAttempt,
} from "./lib/auth/credentials-login.mjs";
import { AUDIT_ACTIONS, recordAudit } from "./lib/audit/record";
import { findUserByEmail } from "./lib/authz/user-repository";
import {
  clearAccountAttempts,
  isBucketBlocked,
  registerAttempt,
} from "./lib/auth/rate-limit-service";
import { clientIpFromRequest } from "./lib/auth/client-ip";
import {
  ACCESS_DENIED,
  ACCESS_FULL,
  describeMfaMode,
  mfaStateFrom,
  resolveMfaMode,
  resolvePortalAccess,
  validateMfaConfiguration,
} from "./lib/auth/mfa-policy.mjs";
import { isMfaConfigured } from "./lib/auth/mfa-crypto.mjs";
import { hasOpenEnrollmentGrant } from "./lib/auth/enrollment-grant";
import { looksLikeRecoveryCode } from "./lib/auth/recovery-codes.mjs";
import {
  consumeRecoveryCode,
  readMfaStatus,
  verifyTotpForUser,
} from "./lib/auth/mfa-service";
import {
  canCustomerSignIn,
  SUBJECT_CUSTOMER,
  SUBJECT_INTERNAL,
} from "./lib/authz/customer-scope.mjs";
import {
  loadCustomerAccountForLogin,
  markCustomerSignedIn,
  recordCustomerLoginFailure,
} from "./lib/customers/account-service";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
  // Jedno polje za oba oblika drugog faktora. Iz odgovora se nikad ne sme
  // zaključiti koji je od njih korisnik uneo.
  secondFactor: z.string().max(64).optional(),
});

/** Kupčeva prijava nema drugi faktor u ovoj fazi — vidi provajder ispod. */
const customerCredentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

/**
 * Režim se razrešava i proverava na granici zahteva, ne pri uvozu modula.
 *
 * Pri uvozu bi provera pala tokom `next build`, kada promenljive okruženja
 * najčešće ne postoje — a build 1.114 javnih statičkih strana ne sme da zavisi
 * od podešavanja portala.
 *
 * Naziv režima se ispiše jednom po procesu. U dnevnik ide isključivo ime režima
 * i okruženja; nijedan ključ, kod ni tajna.
 */
let mfaModeAnnounced = false;

/**
 * SAMO za testove: vraća zastavicu „ime režima već ispisano" na početno
 * stanje. Produkcijski kod ovo nikad ne poziva — svaki novi proces (cold
 * start) prirodno počinje sa `false`. Isti obrazac kao
 * `__resetRateLimitLogStateForTests` u `lib/auth/rate-limit-service.ts`
 * (AUTH-02) — resetuje samo lokalnu promenljivu, nikad konfiguraciju.
 */
export function __resetMfaAnnouncementForTests(): void {
  mfaModeAnnounced = false;
}

export function resolveMfaRuntime() {
  const resolved = resolveMfaMode(process.env);

  if (!mfaModeAnnounced) {
    mfaModeAnnounced = true;
    const note = describeMfaMode(resolved);
    if (note.level === "warn") console.warn(note.message);
    else console.info(note.message);
  }

  const configuration = validateMfaConfiguration({
    mode: resolved.mode,
    mfaConfigured: isMfaConfigured(process.env),
    offRejectedOnRemoteDeployment: resolved.offRejectedOnRemoteDeployment,
  });

  return { ...resolved, configuration };
}

/** Posle ovoliko uzastopnih promašaja nalog se zaključava na kratko. */
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

/**
 * Posledice neuspele lozinke: brojač, zaključavanje i audit.
 *
 * Izdvojeno iz `authorize` da bi redosled provera tamo ostao čitljiv.
 */
async function recordPasswordFailure(
  user: { id: string; name: string; role: string; email: string; failedLoginAttempts: number; lockedUntil: Date | null },
  reason: string,
  rateLimited: boolean,
) {
  if (rateLimited) {
    await recordAudit({
      actor: { id: user.id, name: user.name, role: user.role },
      action: AUDIT_ACTIONS.rateLimitBlocked,
      entityType: "Korisnik",
      entityId: user.id,
      entityLabel: user.email,
      reason: "Previše neuspelih pokušaja prijave",
    });
    return;
  }

  if (!shouldCountFailedAttempt(reason)) return;

  const attempts = user.failedLoginAttempts + 1;
  const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
  await getDb()
    .update(users)
    .set({
      failedLoginAttempts: attempts,
      lockedUntil: shouldLock
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
        : user.lockedUntil,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  await recordAudit({
    actor: { id: user.id, name: user.name, role: user.role },
    action: shouldLock ? AUDIT_ACTIONS.loginLocked : AUDIT_ACTIONS.loginFailed,
    entityType: "Korisnik",
    entityId: user.id,
    entityLabel: user.email,
    reason: shouldLock
      ? `${attempts} uzastopnih neuspelih prijava — nalog zaključan ${LOCK_MINUTES} minuta`
      : `Neuspeli pokušaj prijave (${attempts})`,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-pošta", type: "email" },
        password: { label: "Lozinka", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const identifier = parsed.data.email.trim().toLowerCase();
        const clientIp = await clientIpFromRequest();

        /*
         * 1. Brojači se proveravaju PRE skupog posla.
         *
         * scrypt traje ~100 ms; kada je bucket već blokiran, taj rad je čist
         * poklon napadaču. Zato se blokada gleda pre provere lozinke.
         */
        if (await isBucketBlocked({ scope: "password", accountIdentifier: identifier, clientIp })) {
          return null;
        }

        /*
         * 2. Odluka o lozinci — tačno jedna provera, i za nepostojeći nalog.
         *    Vidi `lib/auth/credentials-login.mjs`.
         */
        const decision = await resolveCredentialsLogin({
          email: parsed.data.email,
          password: parsed.data.password,
          loadUser: findUserByEmail,
          verify: verifyPassword,
          absentUserHash: ABSENT_USER_PASSWORD_RECORD,
        });

        const { outcome, reason, user } = decision;

        // 3. Neuspeh lozinke se broji, bez obzira na to da li nalog postoji.
        if (outcome === "denied") {
          const limit = await registerAttempt({
            scope: "password",
            accountIdentifier: identifier,
            clientIp,
          });
          if (!user) return null;
          await recordPasswordFailure(user, reason, limit.allowed === false);
          return null;
        }

        if (!user) return null;

        /*
         * 4. Drugi faktor.
         *
         * Odluku donosi ISKLJUČIVO `resolvePortalAccess`. Ovde se samo
         * prikuplja stanje koje ta odluka traži — nijedna grana ispod ne sme
         * sama zaključiti da korisnik sme unutra.
         */
        const { mode, environment, configuration } = resolveMfaRuntime();

        /*
         * Nepotpuna konfiguracija odbija prijavu, ne preskače MFA.
         *
         * `enroll` i `enforced` bez ključa znače da niko ne može ni da veže ni
         * da potvrdi faktor. Propustiti takvu prijavu značilo bi da nedostatak
         * ključa tiho ukida drugi faktor — tačno suprotno od namere režima.
         */
        if (!configuration.ok) {
          console.error(configuration.reason);
          return null;
        }

        const status = await readMfaStatus(user.id);
        const submitted = parsed.data.secondFactor?.trim() ?? "";

        let factor: "none" | "totp" | "recovery" = "none";

        if (status.enabled) {
          if (submitted === "") return null;

          const scope = looksLikeRecoveryCode(submitted) ? "recovery" : "totp";
          if (await isBucketBlocked({ scope, accountIdentifier: identifier, clientIp })) {
            return null;
          }

          /*
           * Rezervni kod se troši TEK OVDE — posle tačne lozinke. Napadač bez
           * lozinke ne sme moći da iscrpi tuđe rezervne kodove.
           */
          const verified =
            scope === "recovery"
              ? await consumeRecoveryCode({ userId: user.id, code: submitted })
              : await verifyTotpForUser({ userId: user.id, token: submitted });

          if (!verified) {
            const limit = await registerAttempt({
              scope,
              accountIdentifier: identifier,
              clientIp,
            });
            if (!limit.allowed) {
              await recordAudit({
                actor: { id: user.id, name: user.name, role: user.role },
                action: AUDIT_ACTIONS.mfaVerificationBlocked,
                entityType: "Korisnik",
                entityId: user.id,
                entityLabel: user.email,
                reason: "Previše neuspelih provera drugog faktora",
              });
            }
            return null;
          }

          factor = scope === "recovery" ? "recovery" : "totp";

          if (factor === "recovery") {
            await recordAudit({
              actor: { id: user.id, name: user.name, role: user.role },
              action: AUDIT_ACTIONS.recoveryCodeUsed,
              entityType: "Korisnik",
              entityId: user.id,
              entityLabel: user.email,
              // Sam kod se NIKADA ne beleži.
              reason: "Prijava rezervnim kodom umesto aplikacijom",
            });
          }
        }

        /*
         * Dozvola za vezivanje se čita samo kada je odluka od nje zavisi.
         *
         * U režimu `enforced` bez aktivnog faktora, korisnik sme unutra samo ako
         * ima važeću dozvolu — inače bi `enforced` bio slabiji od `enroll`, jer
         * bi svako sa lozinkom mogao da veže svoj uređaj.
         */
        const grantAvailable =
          mode === "enforced" && !status.enabled
            ? await hasOpenEnrollmentGrant(user.id)
            : false;

        const accessDecision = resolvePortalAccess({
          mode,
          environment,
          /*
           * `resolveCredentialsLogin` već odbija isključen nalog, ali vrednost
           * ide i ovde: politika mora videti pravo stanje, a ne tvrdnju pozivaoca.
           * Dupla provera je jeftina; propušten isključen nalog nije.
           */
          accountActive: user.active,
          mfaState: mfaStateFrom(status),
          factor,
          grantAvailable,
        });

        /*
         * Odbijanje je tiho i generično.
         *
         * „Nemate dozvolu za vezivanje" reklo bi napadaču sa tačnom lozinkom da
         * je pogodio nalog i da mu nedostaje samo još jedan korak.
         */
        if (accessDecision.access === ACCESS_DENIED) return null;

        const db = getDb();
        await db
          .update(users)
          .set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: sql`now()`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // 5. Tek posle KOMPLETNO uspešne prijave se čisti brojač po nalogu.
        //    Brojač po adresi ostaje — vidi `clearAccountAttempts`.
        await clearAccountAttempts("password", identifier);
        if (status.enabled) {
          await clearAccountAttempts(
            factor === "recovery" ? "recovery" : "totp",
            identifier,
          );
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          sessionVersion: user.sessionVersion,
          subject: SUBJECT_INTERNAL,
          // Nivo potvrde dolazi iz odluke, ne iz lokalne promenljive: token ne
          // sme tvrditi više nego što je politika priznala.
          assurance: accessDecision.assurance,
          mfaVerifiedAt: accessDecision.access === ACCESS_FULL && factor !== "none"
            ? Date.now()
            : null,
        };
      },
    }),

    /*
     * Kupčeva prijava — ODVOJEN provajder, odvojena tabela, odvojen `subject`.
     *
     * Interni provajder iznad se ne dira. Da je kupac dodat u njega, jedan
     * `authorize` bi morao da bira između dve tabele naloga — a grana koja bira
     * je grana koja jednom izabere pogrešno.
     *
     * MFA se ovde NE traži: politika drugog faktora je pisana za interne naloge
     * (`resolvePortalAccess`), i primeniti je na kupce bez odluke vlasnika
     * značilo bi ili zaključati sve kupce napolju ili tiho oslabiti internu
     * politiku. Vidi docs/b2b/02-auth-roles-tenancy.md, §5.
     */
    Credentials({
      id: "customer",
      name: "Kupac",
      credentials: {
        email: { label: "E-pošta", type: "email" },
        password: { label: "Lozinka", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = customerCredentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const identifier = parsed.data.email.trim().toLowerCase();
        const clientIp = await clientIpFromRequest();

        // Isti brojači kao kod internih naloga; skup posao ide tek posle njih.
        if (
          await isBucketBlocked({
            scope: "password",
            accountIdentifier: identifier,
            clientIp,
          })
        ) {
          return null;
        }

        /*
         * Jedna provera lozinke i za nepostojeći nalog — isti razlog i isti
         * modul kao interna prijava. Bez toga bi vreme odgovora odalo koje
         * adrese imaju otvoren nalog kod kog kupca.
         */
        const decision = await resolveCredentialsLogin({
          email: parsed.data.email,
          password: parsed.data.password,
          // Nalog bez lozinke košta isto — vidi `loadCustomerAccountForLogin`.
          loadUser: loadCustomerAccountForLogin,
          verify: verifyPassword,
          absentUserHash: ABSENT_USER_PASSWORD_RECORD,
          /*
           * Kupčev nalog nema `active`, nego `status`. Prevod je ovde, jer
           * `resolveCredentialsLogin` namerno ne poznaje dva modela naloga.
           */
          isActive: (account) => canCustomerSignIn(account.status),
        });

        if (decision.outcome === "denied") {
          const limit = await registerAttempt({
            scope: "password",
            accountIdentifier: identifier,
            clientIp,
          });
          /*
           * Neuspeh se BELEŽI i BROJI — postflight audit F-4 i F-5.
           *
           * Ranije je customer grana samo uvećavala IP/nalog bucket: kolone
           * `failed_login_attempts` i `locked_until` su postojale i proveravale
           * se, ali ih niko nije popunjavao, a nijedan neuspeh nije ostavljao
           * trag. Napad na kupčev nalog bio je nevidljiv.
           */
          if (decision.user) {
            await recordCustomerLoginFailure({
              accountId: decision.user.id,
              email: decision.user.email,
              reason: decision.reason as "bad_password" | "inactive" | "locked",
              rateLimited: limit.allowed === false,
            });
          }
          return null;
        }
        if (!decision.user) return null;

        const account = decision.user;

        await markCustomerSignedIn(account.id, account.email);
        await clearAccountAttempts("password", identifier);

        return {
          id: account.id,
          name: account.name,
          email: account.email,
          sessionVersion: account.sessionVersion,
          subject: SUBJECT_CUSTOMER,
          // Kupčeva sesija nikada ne tvrdi drugi faktor koji nije dat.
          assurance: "password",
          mfaVerifiedAt: null,
        };
      },
    }),

    /*
     * Obnova kupčeve sesije sa zapamćenog uređaja („Zapamti me", 0031).
     *
     * Ne prima lozinku ni token: prima JEDNOKRATNU dozvolu koju je izdao
     * `redeemRememberToken` posle provere i rotacije tokena (60 s, jedna
     * upotreba). Izdaje običnu kupčevu sesiju sa `assurance = "remembered"`,
     * pa slanje porudžbine traži ponovni unos lozinke. Interni nalozi ovim
     * putem ne postoje — `consumeRememberGrant` čita samo `customer_users`.
     */
    Credentials({
      id: "customer-remember",
      name: "Kupac (zapamćen uređaj)",
      credentials: { grant: { label: "Dozvola", type: "text" } },
      async authorize(rawCredentials) {
        const grant = typeof rawCredentials?.grant === "string" ? rawCredentials.grant : null;
        const account = await consumeRememberGrant(grant);
        if (!account) return null;
        return {
          id: account.id,
          name: account.name,
          email: account.email,
          sessionVersion: account.sessionVersion,
          subject: SUBJECT_CUSTOMER,
          assurance: "remembered",
          mfaVerifiedAt: null,
        };
      },
    }),
  ],
});
