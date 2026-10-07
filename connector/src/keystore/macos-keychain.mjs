import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Privatni ključ u macOS Keychain-u — za uvoz istorijske arhive sa Mac-a.
 *
 * Bira se samo IZRIČITO (`CS_CONNECTOR_MACOS_KEYCHAIN=1`), na macOS-u. Ključ
 * stoji u keychain-u korisnika (šifrovan, otključan prijavom na Mac); u fajl
 * stanja ide samo oznaka stavke, nikad ključ.
 *
 * Ključ ne prolazi kroz argumente procesa (`ps` ih vidi): upis ide kroz
 * standardni ulaz `security -i`, čitanje kroz standardni izlaz.
 *
 * `CS_CONNECTOR_KEYCHAIN` (putanja do keychain fajla) postoji za testove nad
 * privremenim keychain-om; bez nje se koristi podrazumevani keychain korisnika.
 */
export const adapterIme = "macos-keychain";
export const PROMENLJIVA = "CS_CONNECTOR_MACOS_KEYCHAIN";
const SERVIS = "carsystem-connector";
const ZAGLAVLJE = "macos-keychain-v1";

export function dostupan(env = process.env) {
  return process.platform === "darwin" && env[PROMENLJIVA] === "1";
}

const keychain = (env = process.env) => {
  const k = env.CS_CONNECTOR_KEYCHAIN ?? "";
  // `security -i` deli reči po razmaku; putanja sa razmakom bi se tiho raspala.
  if (/\s/.test(k)) throw new Error("Putanja keychain-a ne sme sadržati razmak.");
  return k;
};

/** Oznaka stavke vezana za putanju fajla stanja — dva konektora ne dele ključ. */
const nalogZa = (putanja) => createHash("sha256").update(String(putanja)).digest("hex").slice(0, 32);

function security(args, ulaz) {
  return new Promise((resolve, reject) => {
    const p = spawn("security", args, { stdio: ["pipe", "pipe", "pipe"] });
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      // Poruka alata se ne prenosi doslovno: ume da sadrži deo komande.
      if (code !== 0) reject(new Error(`macOS Keychain je odbio radnju (kod ${code}).`));
      else resolve(out);
    });
    if (ulaz !== undefined) p.stdin.end(ulaz);
    else p.stdin.end();
  });
}

export async function sacuvaj({ putanja, privateKeyPkcs8Der }) {
  const nalog = nalogZa(putanja);
  const vrednost = Buffer.from(privateKeyPkcs8Der).toString("base64");
  const kc = keychain();
  await security(["-i"], `add-generic-password -U -s ${SERVIS} -a ${nalog} -w ${vrednost}${kc ? ` ${kc}` : ""}\n`);
  await mkdir(dirname(putanja), { recursive: true });
  await writeFile(putanja, `${ZAGLAVLJE}\n${nalog}\n`, { encoding: "utf8", mode: 0o600 });
  await chmod(putanja, 0o600).catch(() => {});
  // Čita se nazad: neuspešan upis je greška sada, a ne pri prvom slanju.
  const nazad = await ucitaj({ putanja });
  if (!Buffer.from(nazad).equals(Buffer.from(privateKeyPkcs8Der))) {
    throw new Error("Ključ pročitan iz keychain-a nije isti kao upisani.");
  }
  return { adapter: adapterIme };
}

export async function ucitaj({ putanja }) {
  const [zaglavlje, nalog] = (await readFile(putanja, "utf8")).split("\n");
  if (zaglavlje !== ZAGLAVLJE || !/^[0-9a-f]{32}$/.test(nalog ?? "")) {
    throw new Error("Fajl ključa nije u očekivanom keychain obliku.");
  }
  const kc = keychain();
  const out = await security(["find-generic-password", "-s", SERVIS, "-a", nalog, "-w", ...(kc ? [kc] : [])]);
  const kljuc = Buffer.from(out.trim(), "base64");
  if (kljuc.length === 0) throw new Error("Keychain nije vratio ključ.");
  return new Uint8Array(kljuc);
}

/** Provera bez trajnih posledica — za `doctor`: upis, čitanje i brisanje probne stavke. */
export async function proveri() {
  const nalog = `provera-${process.pid}-${Date.now()}`;
  const kc = keychain();
  try {
    await security(["-i"], `add-generic-password -U -s ${SERVIS} -a ${nalog} -w cs-provera${kc ? ` ${kc}` : ""}\n`);
    const nazad = (await security(["find-generic-password", "-s", SERVIS, "-a", nalog, "-w", ...(kc ? [kc] : [])])).trim();
    return { adapter: adapterIme, ok: nazad === "cs-provera" };
  } finally {
    await security(["delete-generic-password", "-s", SERVIS, "-a", nalog, ...(kc ? [kc] : [])]).catch(() => {});
  }
}
