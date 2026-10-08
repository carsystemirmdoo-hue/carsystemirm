/**
 * Privatan pristup LOKALNOM test nalogu baze prikaza — za pregled u pregledaču.
 *
 *   cd ~/carsystem-work/portal-integration && \
 *     CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/lokalni-prikaz \
 *     npx tsx --tsconfig db/integration/tsconfig.test.json scripts/ops/local-view-login.mts rep
 *
 * Uloge: owner | office | rep. Ispisuje e-adresu, kopira lozinku u clipboard
 * (macOS `pbcopy`, ne na ekran) i ispisuje trenutni kod drugog faktora sa
 * brojem sekundi do sledećeg. Pokretati u SOPSTVENOM Terminal.app prozoru,
 * ne u panelu terminala aplikacije. Radi samo za lokalnu bazu prikaza.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import * as OTPAuth from "otpauth";
import { readSecrets, SECRETS_FILE } from "./secrets-file.mts";

const role = (process.argv[2] ?? "").toLowerCase();
if (!["owner", "office", "rep"].includes(role)) {
  console.error("Upotreba: local-view-login.mts owner|office|rep");
  process.exit(2);
}
if (readSecrets().DATASET_ROLE !== "lokalni-prikaz") throw new Error("Samo za lokalnu bazu prikaza.");
const acc = readSecrets(path.join(path.dirname(SECRETS_FILE), "local-view-accounts.env"));
const K = role.toUpperCase();
const copied = spawnSync("pbcopy", { input: acc[`LP_${K}_PASSWORD`] }).status === 0;
const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(acc[`LP_${K}_TOTP`]), digits: 6, period: 30 });
console.log(`Adresa:  http://127.0.0.1:3420/prijava`);
console.log(`Nalog:   ${acc[`LP_${K}_EMAIL`]}`);
console.log(copied ? "Lozinka: kopirana u clipboard (nalepite je u polje lozinke)." : "Lozinka: kopiranje nije uspelo.");
console.log(`Kod:     ${totp.generate()}  (važi još ${30 - (Math.floor(Date.now() / 1000) % 30)} s; za nov kod pokrenite ponovo)`);
