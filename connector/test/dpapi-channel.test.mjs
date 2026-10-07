import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { createHash } from "node:crypto";
import {
  argumentiZaDpapi,
  DPAPI_SKRIPTA,
  DPAPI_SKRIPTA_SHA256,
  DpapiError,
  MAX_IZLAZA_BAJTOVA,
  pokreniDpapi,
} from "../src/keystore/windows-dpapi.mjs";

/**
 * Kanal DPAPI adaptera: program je čitljiv `windows-dpapi.ps1` (`-File`), podatak kroz stdin.
 * (Ranije `-EncodedCommand` + `Bypass` — blokirala ga je antivirusna heuristika.)
 *
 * Kancelarijska dijagnostika je izmerila da stari kanal ne radi: `D05` (DPAPI
 * bez podatka na stdin-u) prolazi, `D06` (program i podatak na ISTOM stdin-u,
 * `-Command -`) pada sa izlazom 1. PowerShell je red sa ključem parsirao kao
 * naredbu, umesto da ga pročita `[Console]::In.ReadLine()`.
 *
 * Ovi testovi ne traže Windows: `spawn` se zamenjuje lažnim procesom koji
 * beleži TAČNO šta je dobio — argumente, opcije i bajtove na stdin-u. Stvarno
 * ponašanje PowerShell-a meri `[WIN]` grupa u `windows-smoke.test.mjs`.
 *
 * Uvoz ide iz `src/`, ne iz `dist/`: modul koristi samo ugrađene Node module, pa
 * se jedinični test ne vezuje za build.
 */

/** Sintetički „ključ" — nasumičan, nikad pravi, i prepoznatljiv u izlazu. */
const PAYLOAD = Buffer.from("sinteticki-kljuc-samo-za-test-0123456789abcdef").toString("base64");

/**
 * Lažan `spawn`. Scenario odlučuje šta dete „uradi" pošto primi stdin.
 */
function lazanSpawn(scenario = {}) {
  const zapis = { pozivi: [], stdin: [], ended: false };

  const spawnImpl = (fajl, argumenti, opcije) => {
    zapis.pozivi.push({ fajl, argumenti, opcije });
    if (scenario.bacaPriPokretanju) throw scenario.bacaPriPokretanju;

    const dete = new EventEmitter();
    dete.stdout = new EventEmitter();
    dete.stderr = new EventEmitter();
    dete.stdin = new EventEmitter();
    dete.kill = () => {
      zapis.ubijen = true;
    };
    dete.stdin.write = (d) => {
      zapis.stdin.push(String(d));
      return true;
    };
    dete.stdin.end = () => {
      zapis.ended = true;
      setImmediate(() => {
        if (scenario.epipe) dete.stdin.emit("error", Object.assign(new Error("EPIPE"), { code: "EPIPE" }));
        if (scenario.stderr) dete.stderr.emit("data", Buffer.from(scenario.stderr));
        if (scenario.stdout !== undefined) dete.stdout.emit("data", Buffer.from(scenario.stdout));
        if (scenario.visi) return;
        dete.emit("close", scenario.izlaz ?? 0);
      });
    };
    return dete;
  };

  return { spawnImpl, zapis };
}

/** Tekst koji nijedan izlaz, argument ni greška ne smeju da sadrže. */
function bezTajni(tekst, gde) {
  assert.ok(!String(tekst).includes(PAYLOAD), `${gde} sadrži payload`);
  assert.doesNotMatch(String(tekst), /-----BEGIN/, `${gde} sadrži PEM`);
  assert.doesNotMatch(String(tekst), /[A-Za-z]:[\\/]|file:[/]{3}|\/Users\//, `${gde} sadrži putanju`);
  assert.doesNotMatch(String(tekst), /\n\s+at\s/, `${gde} sadrži stack trace`);
}

/* =========================================================================
 * Program kao fajl, podatak kroz stdin
 * ====================================================================== */

const pokreni = (opcije, rezim = "otkljucaj", ulaz = PAYLOAD) => pokreniDpapi(rezim, ulaz, opcije);

test("program je čitljiv fajl (-File, RemoteSigned) — bez -EncodedCommand, Bypass i -Command", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: PAYLOAD });
  await pokreni({ spawnImpl });
  const { fajl, argumenti } = zapis.pozivi[0];
  assert.equal(fajl, "powershell.exe");
  assert.deepEqual(argumenti, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "RemoteSigned", "-File", DPAPI_SKRIPTA, "-Rezim", "otkljucaj"]);
  for (const zabranjeno of ["-EncodedCommand", "-enc", "Bypass", "-Command"]) {
    assert.ok(!argumenti.includes(zabranjeno), `argument ${zabranjeno}`);
  }
});

test("stdin nosi SAMO podatak — jedan red", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: PAYLOAD });
  await pokreni({ spawnImpl });
  assert.deepEqual(zapis.stdin, [`${PAYLOAD}\n`]);
  assert.ok(zapis.ended, "stdin nije zatvoren; dete bi čekalo ulaz");
});

test("payload NIJE u argumentima ni u okruženju procesa", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: PAYLOAD });
  await pokreni({ spawnImpl });
  const { argumenti, opcije } = zapis.pozivi[0];
  for (const a of argumenti.filter((a) => a !== DPAPI_SKRIPTA)) bezTajni(a, "argument");
  assert.ok(!argumenti.join(" ").includes(PAYLOAD));
  assert.deepEqual(Object.keys(opcije).sort(), ["stdio", "windowsHide"]);
  assert.equal(opcije.windowsHide, true);
  assert.deepEqual(opcije.stdio, ["pipe", "pipe", "pipe"]);
});

test("nepoznat režim i neispravan podatak se odbijaju PRE pokretanja procesa", async () => {
  assert.throws(() => argumentiZaDpapi(DPAPI_SKRIPTA, "Write-Output"), (e) => e.code === "dpapi_mode_invalid");
  for (const los of [`${PAYLOAD}\nWrite-Output x`, "nije base64 !", "", "a b", undefined]) {
    const { spawnImpl, zapis } = lazanSpawn({ stdout: "x" });
    await assert.rejects(() => pokreniDpapi("otkljucaj", los, { spawnImpl }), (e) => e instanceof DpapiError && e.code === "dpapi_input_invalid");
    assert.equal(zapis.pozivi.length, 0, "proces je pokrenut za neispravan podatak");
  }
});

test("izmenjen ili nedostajući program se odbija i proces se ne pokreće", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: PAYLOAD });
  await assert.rejects(
    () => pokreni({ spawnImpl, citaj: async () => Buffer.from("[Console]::In.ReadLine() | Out-File C:\\ukradeno.txt") }),
    (e) => e.code === "dpapi_script_altered",
  );
  await assert.rejects(
    () => pokreni({ spawnImpl, citaj: async () => { throw Object.assign(new Error("ENOENT"), { code: "ENOENT" }); } }),
    (e) => e.code === "dpapi_script_missing",
  );
  assert.equal(zapis.pozivi.length, 0);
});

test("ugrađen SHA-256 odgovara isporučenom windows-dpapi.ps1; fajl čita tačno jedan red i ne piše na disk", () => {
  const bajtovi = readFileSync(DPAPI_SKRIPTA);
  assert.equal(createHash("sha256").update(bajtovi).digest("hex"), DPAPI_SKRIPTA_SHA256);
  const tekst = bajtovi.toString("utf8").replace(/<#[\s\S]*?#>/g, "");
  assert.equal((tekst.match(/\[Console\]::In\.ReadLine\(\)/g) ?? []).length, 1);
  assert.match(tekst, /'CurrentUser'/);
  assert.doesNotMatch(tekst, /LocalMachine|Out-File|Set-Content|Add-Content|New-Item|Write-Host|\$env:TEMP|Invoke-Expression|iex\b/i);
  assert.doesNotMatch(tekst, /EncodedCommand|Bypass/);
});

/* =========================================================================
 * Greške bez sadržaja
 * ====================================================================== */

test("nenulti izlaz daje kod, a stderr deteta NE ulazi u grešku", async () => {
  const { spawnImpl } = lazanSpawn({ izlaz: 2, stderr: `The term '${PAYLOAD}' is not recognized\n    at C:\\Users\\Vlasnik\\x.ps1:1` });
  await assert.rejects(() => pokreni({ spawnImpl }), (e) => {
    assert.ok(e instanceof DpapiError);
    assert.equal(e.code, "dpapi_process_failed");
    bezTajni(`${e.message}\n${e.stack ?? ""}`.split("\n    at ")[0], "poruka greške");
    return true;
  });
});

test("izlaz preko granice se prekida i ne vraća", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: "A".repeat(MAX_IZLAZA_BAJTOVA + 1) });
  await assert.rejects(() => pokreni({ spawnImpl }), (e) => e.code === "dpapi_output_too_large");
  assert.ok(zapis.ubijen, "dete nije prekinuto");
});

test("proces koji visi se prekida posle roka", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ visi: true });
  await assert.rejects(() => pokreni({ spawnImpl, timeoutMs: 30 }), (e) => e.code === "dpapi_timeout");
  assert.ok(zapis.ubijen);
});

test("EINVAL pri pokretanju daje kod, bez putanje izvršnog fajla", async () => {
  const einval = Object.assign(new Error("spawn C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe EINVAL"), { code: "EINVAL" });
  const { spawnImpl } = lazanSpawn({ bacaPriPokretanju: einval });
  await assert.rejects(() => pokreni({ spawnImpl }), (e) => {
    assert.equal(e.code, "dpapi_spawn_einval");
    bezTajni(e.message, "poruka greške");
    return true;
  });
});

test("EPIPE na stdin-u ne postaje neuhvaćen izuzetak", async () => {
  const { spawnImpl } = lazanSpawn({ epipe: true, stdout: PAYLOAD });
  assert.equal(await pokreni({ spawnImpl }), PAYLOAD);
});

/* =========================================================================
 * Izvor adaptera
 * ====================================================================== */

test("izvor adaptera: nema -EncodedCommand, Bypass ni -Command; podatak ne ide kroz okruženje ni privremeni fajl", () => {
  const izvor = readFileSync(fileURLToPath(new URL("../src/keystore/windows-dpapi.mjs", import.meta.url)), "utf8");
  const kod = izvor.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(kod, /EncodedCommand|"Bypass"|"-Command"/);
  assert.doesNotMatch(kod, /process\.env\.[A-Z_]*(KLJUC|KEY|PAYLOAD)/i, "payload kroz okruženje");
  assert.doesNotMatch(kod, /writeFile\([^)]*(tmp|temp)/i, "payload kroz privremeni fajl");
  assert.doesNotMatch(kod, /console\.(log|error|warn)/, "adapter ispisuje na konzolu");
});
