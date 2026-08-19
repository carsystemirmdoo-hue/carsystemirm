import { eq, sql } from "drizzle-orm";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getDb } from "./db/client";
import { users } from "./db/schema";
import { verifyPassword } from "./lib/auth/password.mjs";
import { AUDIT_ACTIONS, recordAudit } from "./lib/audit/record";
import { findUserByEmail } from "./lib/authz/user-repository";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

/** Posle ovoliko uzastopnih promašaja nalog se zaključava na kratko. */
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

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

        const email = parsed.data.email.trim().toLowerCase();
        const user = await findUserByEmail(email);

        // Svi neuspesi vraćaju isti rezultat: iz odgovora se ne sme zaključiti
        // da li nalog postoji, da li je deaktiviran ili je lozinka pogrešna.
        if (!user || !user.active) return null;

        if (user.lockedUntil && user.lockedUntil > new Date()) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        const db = getDb();

        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
          await db
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
            action: shouldLock
              ? AUDIT_ACTIONS.loginLocked
              : AUDIT_ACTIONS.loginFailed,
            entityType: "Korisnik",
            entityId: user.id,
            entityLabel: user.email,
            reason: shouldLock
              ? `${attempts} uzastopnih neuspelih prijava — nalog zaključan ${LOCK_MINUTES} minuta`
              : `Neuspeli pokušaj prijave (${attempts})`,
          });
          return null;
        }

        await db
          .update(users)
          .set({
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: sql`now()`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
});
