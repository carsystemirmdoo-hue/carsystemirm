/**
 * Runtime ugovor konektora — jedno mesto, testabilno van Windows-a.
 *
 * ZAŠTO POSTOJI
 * =============
 * Prvi stvarni smoke je pao na `W02` sa `node_minor_mismatch`, na Node **24.20.0**.
 * Runner je tražio doslovno `24.14.x`, iako to nigde nije ugovor: entrypoint
 * (`connector/bin/connector.mjs`) traži `major >= 22` i da se `node:sqlite`
 * stvarno uveze. Node 24.20.0 oba uslova ispunjava.
 *
 * Zaključana minor verzija je pretvorila ispravan runtime u FAIL, a FAIL na
 * `W02` je onda izgledao kao da paket ne radi na toj mašini.
 *
 * TRI ISHODA, NE DVA
 * ==================
 * Ispod ugovora je **FAIL** — konektor tamo stvarno ne radi.
 * Na testiranom major-u je **PASS**.
 * Iznad ugovora a van testiranog major-a je **SKIP**, ne PASS i ne FAIL:
 * konektor bi radio, ali taj runtime niko nije proverio. Prikazati to kao PASS
 * značilo bi tvrditi nešto što nije mereno.
 */

/**
 * Minimalni major koji entrypoint sprovodi.
 *
 * MORA se poklapati sa `MINIMALNI_MAJOR` u `connector/bin/connector.mjs`.
 * Test `runtime-contract.test.mjs` čita oba i pada ako se raziđu — dve
 * konstante koje znače isto se pre ili kasnije raziđu ako ih niko ne poredi.
 */
export const MINIMALNI_MAJOR = 22;

/**
 * Major iz `requiredNode` u `package-meta.json` (npr. `"24.14.x (…)"` → 24).
 *
 * Testirani major se ne kuca u kod: pakovanje ga zapisuje uz paket, pa se čita
 * odatle. Kada se paket bude gradio za drugi major, ovde se ništa ne menja.
 *
 * @param {string} requiredNode
 * @returns {number|null}
 */
export function testiraniMajor(requiredNode) {
  const m = /^\s*(\d+)\./.exec(String(requiredNode ?? ""));
  return m ? Number(m[1]) : null;
}

/**
 * @typedef {object} OcenaRuntimea
 * @property {"pass"|"fail"|"skip"} status
 * @property {string|null} kod
 * @property {string} detalj
 */

/**
 * Ocenjuje tekući Node prema ugovoru.
 *
 * `sqliteDostupan` je OBAVEZAN i dolazi iz stvarnog pokušaja uvoza, ne iz
 * verzije: entrypoint radi isto. Postoje build-ovi koji znaju za ime modula a
 * `import` im puca, i upravo zbog njih se verzija ne sme uzeti kao dokaz.
 *
 * @param {{verzija: string, testirani: number|null, sqliteDostupan: boolean}} ulaz
 * @returns {OcenaRuntimea}
 */
export function oceniRuntime({ verzija, testirani, sqliteDostupan }) {
  const delovi = String(verzija ?? "").split(".");
  const major = Number(delovi[0]);

  if (!Number.isFinite(major) || delovi.length < 3) {
    return { status: "fail", kod: "node_version_unparseable", detalj: "verzija Node-a nije prepoznata" };
  }

  if (major < MINIMALNI_MAJOR) {
    return {
      status: "fail",
      kod: "node_below_contract",
      detalj: `Node ${verzija}; konektor traži major ${MINIMALNI_MAJOR}+`,
    };
  }

  /*
   * Modul se proverava POSLE verzije, da poruka ne bi bila obmanjujuća.
   *
   * Na Node 20 je odsustvo `node:sqlite` posledica verzije; prijaviti ga kao
   * zaseban kvar poslalo bi nekoga da traži nepostojeći problem.
   */
  if (!sqliteDostupan) {
    return {
      status: "fail",
      kod: "node_sqlite_unavailable",
      detalj: `Node ${verzija} zna za major, ali \`node:sqlite\` se ne uvozi`,
    };
  }

  if (testirani === null) {
    return {
      status: "skip",
      kod: "tested_major_unknown",
      detalj: "paket ne navodi testirani major u package-meta.json",
    };
  }

  if (major !== testirani) {
    return {
      status: "skip",
      kod: "node_major_untested",
      detalj:
        `Node ${verzija} zadovoljava ugovor (major ${MINIMALNI_MAJOR}+), ` +
        `ali paket je testiran na major ${testirani}`,
    };
  }

  return { status: "pass", kod: null, detalj: `Node ${verzija} (testiran major ${testirani})` };
}
