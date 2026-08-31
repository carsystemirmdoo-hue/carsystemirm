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

const { main } = await import("../src/cli.mjs");
process.exitCode = await main();
