#!/usr/bin/env node
/**
 * Izvrsni ulaz konektora.
 *
 * Tanak: sav posao je u `src/cli.mjs`, da bi se komande mogle testirati bez
 * pokretanja procesa. Ovde stoje samo provera runtime-a i izlazni kod, jer ga
 * Task Scheduler cita.
 */

/*
 * Provera runtime-a IDE PRVA, pre ijednog uvoza koji trazi `node:sqlite`.
 *
 * `src/cli.mjs` posredno uvozi trajni red, pa bi na pogresnom Node-u proces pao
 * sa `ERR_UNKNOWN_BUILTIN_MODULE` i sirovim stack trace-om koji operateru ne
 * znaci nista, a odaje lokalne putanje. `engines` u `package.json` nista ne
 * sprovodi kada se pokretac pozove direktno.
 *
 * Zato: dinamicki uvoz TEK posle provere.
 */
const MINIMALNI_MAJOR = 22;
const major = Number(process.versions.node.split(".")[0]);

if (!Number.isFinite(major) || major < MINIMALNI_MAJOR) {
  process.stderr.write(
    `Carsystem konektor trazi Node ${MINIMALNI_MAJOR} ili noviji (testirano na Node 24).\n` +
      `Pokrenut je Node ${process.versions.node}.\n` +
      "Razlog: trajni red koristi `node:sqlite`, koji u starijim verzijama ne postoji.\n",
  );
  process.exit(3);
}

try {
  // Dodatna provera: neke verzije znaju za ime modula, ali `import` puca.
  await import("node:sqlite");
} catch {
  process.stderr.write(
    `Modul \`node:sqlite\` nije dostupan u Node ${process.versions.node}.\n` +
      "Konektor bez njega nema trajni red i ne sme da radi.\n",
  );
  process.exit(3);
}

/*
 * `--packaged` je alternativa ručnom `set CS_CONNECTOR_PACKAGED=1` iz
 * `connector.cmd`/`connector.sh`: Windows Task Scheduler akcija zove ovaj
 * fajl DIREKTNO (apsolutna `node.exe` putanja, bez posrednog launchera u
 * folderu stanja — vidi `connector/windows/task.ps1`), a javni ScheduledTasks
 * API nema način da na akciju zakači promenljivu okruženja. Zastavica na
 * argument liniji je jedini kanal koji ostaje dostupan bez posrednog fajla.
 *
 * Skida se PRE prosleđivanja u `main()` — `src/cli.mjs` ne sme videti
 * nepoznat argument kao komandu.
 */
const argv = process.argv.slice(2);
const oznakaPaketa = argv.indexOf("--packaged");
if (oznakaPaketa !== -1) {
  process.env.CS_CONNECTOR_PACKAGED = "1";
  argv.splice(oznakaPaketa, 1);
}

/*
 * `--config <apsolutna putanja>` je isti kanal-bez-fajla kao `--packaged`,
 * za `CS_CONNECTOR_CONFIG` umesto `CS_CONNECTOR_PACKAGED`.
 *
 * Production Task Scheduler akcija (`task.ps1 -Mode Production`) je koristi
 * da config.json UPERI u instalacioni (package) folder — admin-write-only
 * posle `harden-install-dir.ps1 -Apply` — umesto na podrazumevanu putanju u
 * folderu stanja, koji `RunAsAccount` mora moći da piše (ključ, red). Time
 * `serverOrigin`/`izvorniFolder` iz config.json postaju van domašaja pisanja
 * naloga koji svakodnevno pokreće konektor, dok promenljivo runtime stanje
 * ostaje odvojeno.
 */
const oznakaKonfiguracije = argv.indexOf("--config");
if (oznakaKonfiguracije !== -1) {
  const putanja = argv[oznakaKonfiguracije + 1];
  if (!putanja) {
    process.stderr.write("--config zahteva apsolutnu putanju kao sledeći argument.\n");
    process.exit(2);
  }
  process.env.CS_CONNECTOR_CONFIG = putanja;
  argv.splice(oznakaKonfiguracije, 2);
}

const { main } = await import("../src/cli.mjs");
process.exitCode = await main(argv);
