/**
 * Politika ograničavanja pokušaja i izvođenje ključeva brojača.
 *
 * Čista logika, bez baze — da se pragovi, prozori i izbor klijentske adrese mogu
 * dokazati testom.
 *
 * Šta se ograničava, a šta ne
 * ---------------------------
 * Namerno se NE ograničavaju svi `/api/auth/*` zahtevi. Auth.js na toj putanji
 * opslužuje i čitanje sesije i CSRF token — pozive koje prijavljena strana radi
 * rutinski. Blanket limit bi izbacivao prijavljene korisnike usred rada, a
 * napadaču ne bi smetao. Ograničava se tačno ono što proverava tajnu:
 * lozinka, TOTP, recovery kod i reset kod.
 *
 * @typedef {"password" | "totp" | "recovery" | "reset"} RateLimitScope
 * @typedef {"account" | "ip"} RateLimitDimension
 */

/**
 * Pragovi po opsegu i dimenziji.
 *
 * Dva nezavisna brojača po pokušaju: jedan vezan za nalog, jedan za adresu.
 * Sam brojač po nalogu ne zaustavlja napad koji proba jednu lozinku na hiljadu
 * naloga; sam brojač po adresi ne zaustavlja napad iz botneta na jedan nalog.
 *
 * `blockMs` je koliko traje odbijanje kada se prag pređe. Blokada je uvek
 * privremena — trajno zaključavanje bi značilo da napadač namernim greškama
 * može isključiti tuđi nalog.
 */
export const RATE_LIMIT_POLICY = {
  password: {
    account: { limit: 10, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
    ip: { limit: 30, windowMs: 15 * 60_000, blockMs: 15 * 60_000 },
  },
  totp: {
    // Strože od lozinke: šestocifren kod ima milion mogućnosti, pa je gruba
    // sila realna pretnja ako se dozvoli previše pokušaja.
    account: { limit: 5, windowMs: 10 * 60_000, blockMs: 10 * 60_000 },
    ip: { limit: 30, windowMs: 10 * 60_000, blockMs: 10 * 60_000 },
  },
  recovery: {
    account: { limit: 5, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
    ip: { limit: 20, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
  },
  reset: {
    account: { limit: 5, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
    ip: { limit: 10, windowMs: 30 * 60_000, blockMs: 30 * 60_000 },
  },
};

export const RATE_LIMIT_SCOPES = Object.keys(RATE_LIMIT_POLICY);

/**
 * @param {RateLimitScope} scope
 * @param {RateLimitDimension} dimension
 */
export function policyFor(scope, dimension) {
  const forScope = RATE_LIMIT_POLICY[scope];
  if (!forScope) throw new Error(`Nepoznat opseg ograničenja: ${scope}`);
  const policy = forScope[dimension];
  if (!policy) throw new Error(`Nepoznata dimenzija: ${dimension}`);
  return policy;
}

/**
 * Odluka nad postojećim stanjem brojača.
 *
 * Vraća šta treba upisati, a ne menja ništa — upis radi sloj sa bazom, atomski.
 *
 * @param {{ attempts: number, windowStartedAt: Date, blockedUntil: Date | null } | null} current
 * @param {{ limit: number, windowMs: number, blockMs: number }} policy
 * @param {Date} now
 * @returns {{
 *   allowed: boolean,
 *   retryAfterSeconds: number,
 *   nextAttempts: number,
 *   resetWindow: boolean,
 *   blockUntil: Date | null
 * }}
 */
export function evaluateRateLimit(current, policy, now = new Date()) {
  // Već blokiran i blokada još traje — ništa se ne broji dalje, da napadač ne
  // može da produžava blokadu novim pokušajima.
  if (current?.blockedUntil && current.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((current.blockedUntil.getTime() - now.getTime()) / 1000),
      ),
      nextAttempts: current.attempts,
      resetWindow: false,
      blockUntil: current.blockedUntil,
    };
  }

  const windowExpired =
    !current ||
    now.getTime() - current.windowStartedAt.getTime() >= policy.windowMs;

  const attempts = windowExpired ? 1 : current.attempts + 1;
  const reachedLimit = attempts > policy.limit;

  return {
    allowed: !reachedLimit,
    retryAfterSeconds: reachedLimit ? Math.ceil(policy.blockMs / 1000) : 0,
    nextAttempts: attempts,
    resetWindow: windowExpired,
    blockUntil: reachedLimit
      ? new Date(now.getTime() + policy.blockMs)
      : null,
  };
}

/**
 * Klijentska adresa iz zaglavlja zahteva.
 *
 * `x-forwarded-for` je proizvoljan tekst koji svako može poslati. Verujemo mu
 * SAMO kada ga je prepisao poznat posrednik — na Vercelu je to slučaj, jer
 * platforma prepisuje zaglavlje i klijentska vrednost ne preživljava.
 *
 * Van tog okruženja se uzima adresa veze; ako je nema, vraća se `null` i
 * pozivalac koristi samo brojač po nalogu. Slepo verovanje zaglavlju bi značilo
 * da napadač zaobilazi ograničenje po adresi jednim izmišljenim `X-Forwarded-For`.
 *
 * @param {{
 *   headers: { get(name: string): string | null },
 *   trustedProxy: boolean,
 *   socketAddress?: string | null
 * }} input
 * @returns {string | null}
 */
export function resolveClientIp({ headers, trustedProxy, socketAddress = null }) {
  if (trustedProxy) {
    const forwarded = headers.get("x-forwarded-for");
    if (forwarded) {
      // Vercel dopisuje klijentsku adresu kao PRVU u lancu.
      const first = forwarded.split(",")[0]?.trim();
      if (first) return first;
    }
    const real = headers.get("x-real-ip");
    if (real) return real.trim();
  }

  return socketAddress?.trim() || null;
}

/**
 * Da li se sme verovati posredničkim zaglavljima.
 *
 * Isključivo na Vercelu, gde platforma prepisuje `x-forwarded-for`. Lokalni
 * razvoj i samostalni `next start` nemaju takvu garanciju.
 *
 * @param {{ VERCEL?: string, VERCEL_ENV?: string }} env
 * @returns {boolean}
 */
export function isTrustedProxyEnvironment(env = {}) {
  return env.VERCEL === "1" || typeof env.VERCEL_ENV === "string";
}

/**
 * Da li putanja uopšte podleže ograničavanju kao pokušaj prijave.
 *
 * Čitanje sesije i CSRF token se rutinski pozivaju iz prijavljene strane i ne
 * proveravaju nijednu tajnu.
 *
 * @param {string} pathname
 * @param {string} method
 * @returns {boolean}
 */
export function isCredentialAttemptPath(pathname, method) {
  if (method !== "POST") return false;
  return /\/api\/auth\/callback\/credentials\/?$/.test(pathname);
}
