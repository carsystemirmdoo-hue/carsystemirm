/**
 * Čišćenje pri prekidu posla (Ctrl+C, gašenje runnera, zaustavljen zadatak).
 *
 * Svaki korak koji pravi privremen fajl, probnu bazu ili pokreće podproces
 * prijavljuje svoje čišćenje (`onAbort`). Na SIGINT/SIGTERM/SIGHUP čišćenja se
 * izvršavaju obrnutim redom: prvo se zaustavlja podproces (da ne nastavi da
 * piše), pa se briše ono što je ostalo. Izlazni kod je 130/143/129.
 */
const tasks = new Set();
let installed = false;
let aborting = false;

/** Da li je prekid u toku — tada redovna obrada greške ne sme da završi proces pre čišćenja. */
export function isAborting() {
  return aborting;
}

/** @param {() => (void | Promise<void>)} fn @returns {() => void} odjava */
export function onAbort(fn) {
  tasks.add(fn);
  return () => tasks.delete(fn);
}

/** Zaustavljanje podprocesa kao korak čišćenja (čeka da se zaista ugasi). */
export function killOnAbort(child) {
  return onAbort(
    () =>
      new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) return resolve();
        child.once("close", () => resolve());
        child.kill("SIGTERM");
        setTimeout(() => { try { child.kill("SIGKILL"); } catch {} resolve(); }, 5000).unref();
      }),
  );
}

export function installAbortHandlers(log = () => {}) {
  if (installed) return;
  installed = true;
  const codes = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };
  let running = false;
  for (const sig of Object.keys(codes)) {
    process.on(sig, async () => {
      if (running) return;
      running = true;
      aborting = true;
      log(`prekid (${sig}) — zaustavljam podprocese i brišem privremene fajlove`);
      for (const t of [...tasks].reverse()) {
        try { await t(); } catch {}
      }
      process.exit(codes[sig]);
    });
  }
}
