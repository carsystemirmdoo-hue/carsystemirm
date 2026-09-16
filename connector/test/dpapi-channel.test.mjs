import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  argumentiZa,
  DpapiError,
  kodiranaKomanda,
  MAX_IZLAZA_BAJTOVA,
  pokreniPowerShell,
} from "../src/keystore/windows-dpapi.mjs";

/**
 * Kanal DPAPI adaptera: program kroz `-EncodedCommand`, podatak kroz stdin.
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
const PROGRAM = "$ErrorActionPreference = 'Stop'; [Console]::In.ReadLine()";

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
 * Razdvajanje kanala
 * ====================================================================== */

test("program ide kroz -EncodedCommand, a NE kroz -Command -", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: PAYLOAD });
  await pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl });

  const { fajl, argumenti } = zapis.pozivi[0];
  assert.equal(fajl, "powershell.exe");
  assert.ok(!argumenti.includes("-Command"), "stari -Command - kanal je i dalje u upotrebi");
  const i = argumenti.indexOf("-EncodedCommand");
  assert.ok(i >= 0, "nema -EncodedCommand");

  // Vrednost je UTF-16LE base64 TAČNO ovog programa.
  const dekodovano = Buffer.from(argumenti[i + 1], "base64").toString("utf16le");
  assert.equal(dekodovano, PROGRAM);
});

test("stdin nosi SAMO podatak — nijedan red programa", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: PAYLOAD });
  await pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl });

  assert.deepEqual(zapis.stdin, [`${PAYLOAD}\n`], "stdin nije tačno jedan red podatka");
  assert.ok(zapis.ended, "stdin nije zatvoren; dete bi čekalo ulaz");
  assert.ok(!zapis.stdin.join("").includes("ReadLine"), "program je na stdin-u");
});

test("payload NIJE u argumentima ni u okruženju procesa", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: PAYLOAD });
  await pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl });

  const { argumenti, opcije } = zapis.pozivi[0];
  for (const a of argumenti) bezTajni(a, "argument");
  // Kodirana vrednost programa takođe ne sme da krije payload.
  const program = Buffer.from(argumenti[argumenti.length - 1], "base64").toString("utf16le");
  assert.ok(!program.includes(PAYLOAD), "payload je ugrađen u program");

  /*
   * Nijedna opcija osim stdio i windowsHide: posebno ne `env`, jer bi payload u
   * promenljivoj okruženja bio vidljiv svakom procesu koji čita okruženje deteta.
   */
  assert.deepEqual(Object.keys(opcije).sort(), ["stdio", "windowsHide"]);
  assert.equal(opcije.windowsHide, true);
  assert.deepEqual(opcije.stdio, ["pipe", "pipe", "pipe"]);
});

test("bez podatka stdin se samo zatvara", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: "OK" });
  assert.equal(await pokreniPowerShell("'OK'", undefined, { spawnImpl }), "OK");
  assert.deepEqual(zapis.stdin, []);
  assert.ok(zapis.ended);
});

test("argumentiZa i kodiranaKomanda daju ASCII bez razmaka i novih redova", () => {
  const program = "$a = 1\n$b = 'Č'\r\n[Console]::In.ReadLine()";
  const kod = kodiranaKomanda(program);
  assert.match(kod, /^[A-Za-z0-9+/]+={0,2}$/);
  assert.equal(Buffer.from(kod, "base64").toString("utf16le"), program);
  for (const a of argumentiZa(program)) assert.doesNotMatch(a, /[\s"]/);
});

/* =========================================================================
 * Odbijanje neispravnog podatka
 * ====================================================================== */

test("podatak sa novim redom se odbija PRE pokretanja procesa", async () => {
  for (const los of [`${PAYLOAD}\nWrite-Output x`, "nije base64 !", "", "a b"]) {
    const { spawnImpl, zapis } = lazanSpawn({ stdout: "x" });
    await assert.rejects(
      () => pokreniPowerShell(PROGRAM, los, { spawnImpl }),
      (e) => e instanceof DpapiError && e.code === "dpapi_input_invalid",
      `prihvaćen podatak: ${JSON.stringify(los.slice(0, 20))}`,
    );
    assert.equal(zapis.pozivi.length, 0, "proces je pokrenut za neispravan podatak");
  }
});

/* =========================================================================
 * Greške bez sadržaja
 * ====================================================================== */

test("nenulti izlaz daje kod, a stderr deteta NE ulazi u grešku", async () => {
  const { spawnImpl } = lazanSpawn({
    izlaz: 1,
    stderr: `The term '${PAYLOAD}' is not recognized\n    at C:\\Users\\Vlasnik\\x.ps1:1`,
  });
  await assert.rejects(
    () => pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl }),
    (e) => {
      assert.ok(e instanceof DpapiError);
      assert.equal(e.code, "dpapi_process_failed");
      bezTajni(`${e.message}\n${e.stack ?? ""}`.split("\n    at ")[0], "poruka greške");
      return true;
    },
  );
});

test("izlaz preko granice se prekida i ne vraća", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ stdout: "A".repeat(MAX_IZLAZA_BAJTOVA + 1) });
  await assert.rejects(
    () => pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl }),
    (e) => e.code === "dpapi_output_too_large",
  );
  assert.ok(zapis.ubijen, "dete nije prekinuto");
});

test("proces koji visi se prekida posle roka", async () => {
  const { spawnImpl, zapis } = lazanSpawn({ visi: true });
  await assert.rejects(
    () => pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl, timeoutMs: 30 }),
    (e) => e.code === "dpapi_timeout",
  );
  assert.ok(zapis.ubijen);
});

test("EINVAL pri pokretanju daje kod, bez putanje izvršnog fajla", async () => {
  const einval = Object.assign(
    new Error("spawn C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe EINVAL"),
    { code: "EINVAL" },
  );
  const { spawnImpl } = lazanSpawn({ bacaPriPokretanju: einval });
  await assert.rejects(
    () => pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl }),
    (e) => {
      assert.equal(e.code, "dpapi_spawn_einval");
      bezTajni(e.message, "poruka greške");
      return true;
    },
  );
});

test("EPIPE na stdin-u ne postaje neuhvaćen izuzetak", async () => {
  const { spawnImpl } = lazanSpawn({ epipe: true, stdout: PAYLOAD });
  // Da `error` nema slušaoca, EventEmitter bi bacio izuzetak i srušio proces.
  assert.equal(await pokreniPowerShell(PROGRAM, PAYLOAD, { spawnImpl }), PAYLOAD);
});

/* =========================================================================
 * Izvor adaptera
 * ====================================================================== */

test("skripte adaptera čitaju TAČNO jedan red i ne koriste -Command -", () => {
  const izvor = readFileSync(
    fileURLToPath(new URL("../src/keystore/windows-dpapi.mjs", import.meta.url)),
    "utf8",
  );
  const kod = izvor.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  assert.doesNotMatch(kod, /"-Command",\s*"-"/, "stari kanal je u kodu");
  assert.equal((kod.match(/\[Console\]::In\.ReadLine\(\)/g) ?? []).length, 2);
  assert.doesNotMatch(kod, /process\.env\.[A-Z_]*(KLJUC|KEY|PAYLOAD)/i, "payload kroz okruženje");
  assert.doesNotMatch(kod, /writeFile\([^)]*(tmp|temp)/i, "payload kroz privremeni fajl");
  assert.doesNotMatch(kod, /console\.(log|error|warn)/, "adapter ispisuje na konzolu");
});
