"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { users } from "@/db/schema";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit/record";
import { clientIpFromRequest } from "@/lib/auth/client-ip";
import { verifyTotpForUser } from "@/lib/auth/mfa-service";
import {
  clearAccountAttempts,
  isBucketBlocked,
  registerAttempt,
} from "@/lib/auth/rate-limit-service";
import { hashPassword, verifyPassword } from "@/lib/auth/password.mjs";
import { revokeUserSessions } from "@/lib/auth/session-revocation";
import { requireFullPortalUser } from "@/lib/authz/session";
import { findUserByEmail } from "@/lib/authz/user-repository";
import { EMPTY_PASSWORD_CHANGE, type PasswordChangeState } from "./types";

/**
 * Promena sopstvene lozinke.
 *
 * Traži se troje: puna sesija, trenutna lozinka i svež kod iz aplikacije.
 *
 * Zašto sva tri
 * -------------
 * Sesija sama nije dokaz — otvoren laptop je dovoljan da neko promeni lozinku i
 * zaključa vlasnika. Trenutna lozinka sama nije dokaz — ako je procurela, napadač
 * je ima. Kod iz aplikacije sam nije dokaz — telefon se gubi. Sve troje
 * istovremeno napadač gotovo nikad nema.
 *
 * Kod prolazi kroz `verifyTotpForUser`, dakle sa zaštitom od ponovne upotrebe:
 * presretnut kod ne prolazi drugi put.
 */

/** Ista poruka za svaki neuspeh — razlog ide u audit, ne korisniku. */
const GENERIC = "Podaci nisu ispravni. Proverite lozinku i kod iz aplikacije.";

/*
 * Donja granica dužine je jedina tvrda provera.
 *
 * Pravila tipa „mora imati veliko slovo i cifru" teraju ljude na `Lozinka1!`,
 * što je slabije od duge fraze. Dužina je jedino što stvarno pomaže.
 */
const schema = z
  .object({
    current: z.string().min(1).max(200),
    next: z.string().min(12).max(200),
    confirm: z.string().min(1).max(200),
    token: z.string().trim().min(6).max(8),
  })
  .refine((value) => value.next === value.confirm, {
    message: "Potvrda se ne poklapa.",
  })
  .refine((value) => value.next !== value.current, {
    message: "Nova lozinka mora biti različita od trenutne.",
  });

export async function changeOwnPasswordAction(
  _previous: PasswordChangeState,
  formData: FormData,
): Promise<PasswordChangeState> {
  const user = await requireFullPortalUser();

  const parsed = schema.safeParse({
    current: String(formData.get("current") ?? ""),
    next: String(formData.get("next") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
    token: String(formData.get("token") ?? ""),
  });
  if (!parsed.success) {
    return {
      ...EMPTY_PASSWORD_CHANGE,
      error:
        parsed.error.issues[0]?.message ??
        "Nova lozinka mora imati najmanje 12 znakova.",
    };
  }

  /*
   * I ovaj ekran broji pokušaje.
   *
   * Prijava je ograničena, ali promena lozinke iza otvorene sesije nije bila —
   * a traži baš ono što napadač želi da pogodi: trenutnu lozinku i šestocifreni
   * kod. Bez brojača bi otvoren laptop bio dovoljan da se oba probaju
   * neograničeno.
   */
  const clientIp = await clientIpFromRequest();
  if (
    await isBucketBlocked({
      scope: "totp",
      accountIdentifier: user.email,
      clientIp,
    })
  ) {
    return {
      ...EMPTY_PASSWORD_CHANGE,
      error: "Previše pokušaja. Sačekajte nekoliko minuta pa pokušajte ponovo.",
    };
  }

  const record = await findUserByEmail(user.email);
  const passwordOk =
    record !== null &&
    (await verifyPassword(parsed.data.current, record.passwordHash));
  // Kod se proverava i kada je lozinka pogrešna, da razlika u vremenu odgovora
  // ne kaže koja je od dve stvari promašena.
  const tokenOk = await verifyTotpForUser({
    userId: user.id,
    token: parsed.data.token,
  });

  if (!passwordOk || !tokenOk) {
    await registerAttempt({
      scope: "totp",
      accountIdentifier: user.email,
      clientIp,
    });
    return { ...EMPTY_PASSWORD_CHANGE, error: GENERIC };
  }

  await clearAccountAttempts("totp", user.email);

  const passwordHash = await hashPassword(parsed.data.next);
  const now = new Date();

  /*
   * Novi otisak, opoziv sesija i oba traga u JEDNOJ transakciji.
   *
   * Inače bi postojalo stanje u kome je lozinka nova a stara sesija još radi —
   * tačno ono što promena lozinke treba da spreči.
   */
  await getDb().transaction(async (tx) => {
    await tx
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, user.id));

    await revokeUserSessions(tx, user.id, now);

    const actor = { id: user.id, name: user.name, role: user.role };
    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.passwordChanged,
        entityType: "Korisnik",
        entityId: user.id,
        entityLabel: user.email,
        // Ni stara ni nova lozinka, ni njihov otisak, ne ulaze u trag.
        reason: "Korisnik je sam promenio lozinku",
      },
      tx,
    );
    await recordAudit(
      {
        actor,
        action: AUDIT_ACTIONS.sessionsRevoked,
        entityType: "Korisnik",
        entityId: user.id,
        entityLabel: user.email,
        reason: "Sve sesije opozvane posle promene lozinke",
      },
      tx,
    );
  });

  // Tekuća sesija je već nevažeća; sledeći zahtev je odbija. Ekran zato nudi
  // odjavu umesto da se pretvara da je sve po starom.
  return { error: null, done: true };
}
