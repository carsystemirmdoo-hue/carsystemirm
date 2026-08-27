/**
 * Zamena za `server-only` u integracionom test procesu.
 *
 * Produkcijski moduli (`lib/auth/*.ts`, `lib/authz/*.ts`) počinju sa
 * `import "server-only"`. Taj paket namerno baca izuzetak van React Server
 * Component konteksta, pa se pravi kod ne bi mogao uvesti u `node --test`.
 *
 * Bez ovoga integracioni test bi morao da PREPIŠE SQL koji testira — a onda ne
 * bi testirao produkcijski kod nego svoju kopiju, i najvažnija greška (razlika
 * između kopije i originala) prošla bi neprimećeno.
 *
 * Zamena važi isključivo u test procesu, kroz `db/integration/tsconfig.test.json`.
 * Aplikacijski `tsconfig.json` se ne dira, pa build i dalje vidi pravi paket.
 */
export {};
