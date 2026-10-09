import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Zadatak bez konzolnog prozora (0.3.13): wscript.exe + windows/pokreni-skriveno.js.
 *
 * JScript se ovde IZVRŠAVA sa lažnim WScript/ActiveXObject okruženjem — proverava
 * se tačna komandna linija za node.exe, skriven prozor (0), čekanje kraja i da
 * izlazni kod node.exe-a postaje izlazni kod zadatka.
 */
const IZVOR = readFileSync(new URL("../windows/pokreni-skriveno.js", import.meta.url), "utf8");
const TASK = readFileSync(new URL("../windows/task.ps1", import.meta.url), "utf8").replace(/^\uFEFF/, "");
const PROBA = readFileSync(new URL("../windows/proba-zadatka.ps1", import.meta.url), "utf8").replace(/^\uFEFF/, "");

class Kraj {
  constructor(kod) {
    this.kod = kod;
  }
}

function pokreni(argumenti, { izlazNode = 0, baciPriPokretanju = false } = {}) {
  const pozivi = [];
  const args = (i) => argumenti[i];
  Object.defineProperty(args, "length", { value: argumenti.length });
  const WScript = { Arguments: args, Quit: (kod) => { throw new Kraj(kod); } };
  function ActiveXObject(ime) {
    assert.equal(ime, "WScript.Shell");
    this.Run = (komanda, prozor, cekaj) => {
      if (baciPriPokretanju) throw new Error("pristup odbijen");
      pozivi.push({ komanda, prozor, cekaj });
      return izlazNode;
    };
  }
  try {
    new Function("WScript", "ActiveXObject", IZVOR)(WScript, ActiveXObject);
  } catch (e) {
    if (e instanceof Kraj) return { kod: e.kod, pozivi };
    throw e;
  }
  throw new Error("pokretač nije pozvao WScript.Quit");
}

const NODE = "C:\\Program Files\\nodejs\\node.exe";
const ENTRY = "C:\\Program Files\\CarsystemConnector\\connector\\bin\\connector.mjs";
const KONF = "C:\\Program Files\\CarsystemConnector\\config.json";

test("pokretač: skriven prozor (0), čeka kraj, tačni navodnici; izlazni kod node.exe-a postaje izlaz zadatka", () => {
  for (const izlaz of [0, 1, 2, 7, 75]) {
    const r = pokreni([NODE, "--no-warnings", ENTRY, "--packaged", "--config", KONF, "auto"], { izlazNode: izlaz });
    assert.equal(r.kod, izlaz);
    assert.deepEqual(r.pozivi, [{
      komanda: `"${NODE}" --no-warnings "${ENTRY}" --packaged --config "${KONF}" auto`,
      prozor: 0,
      cekaj: true,
    }]);
  }
});

test("pokretač: odbija sve osim apsolutnog node.exe i argumente sa navodnicima ili završnom kosom crtom (87)", () => {
  for (const los of [
    [],
    [NODE],
    ["node.exe", "--help"],
    ["C:\\Windows\\System32\\cmd.exe", "/c", "dir"],
    ["\\\\server\\deljeno\\node.exe", "--help"],
    [NODE, 'a" & calc & "'],
    [NODE, "C:\\folder\\"],
  ]) {
    const r = pokreni(los);
    assert.equal(r.kod, 87, JSON.stringify(los));
    assert.equal(r.pozivi.length, 0, "ništa ne sme biti pokrenuto");
  }
  assert.equal(pokreni([NODE, "--help"], { baciPriPokretanju: true }).kod, 86);
});

test("pokretač: samo ASCII (wscript čita fajl u sistemskoj kodnoj strani)", () => {
  assert.doesNotMatch(IZVOR, /[^\x00-\x7F]/);
});

test("task.ps1: Skriveno je podrazumevano; wscript iz System32, pokretač iz INSTALACIONOG foldera; nalog/RunLevel isti", () => {
  assert.match(TASK, /\[ValidateSet\('Skriveno', 'Prozor'\)\]\s*\n\s*\[string\]\$Prikaz = 'Skriveno'/);
  assert.match(TASK, /\$wscript = Join-Path \$env:SystemRoot 'System32\\wscript\.exe'/);
  assert.match(TASK, /\$pokretac = Join-Path \$resolvedPackagePath 'windows\\pokreni-skriveno\.js'/);
  assert.match(TASK, /New-ScheduledTaskAction -Execute \$wscript `\s*\n\s*-Argument "\/\/B \/\/NoLogo `"\$pokretac`" `"\$\(\$nodeInfo\.Path\)`" \$argumentZaPrikaz"/);
  // Isti principal za oba prikaza.
  assert.equal((TASK.match(/New-ScheduledTaskPrincipal -UserId \$RunAsAccount -LogonType Interactive -RunLevel Limited/g) ?? []).length, 1);
  // Posle registracije se proverava stvarna akcija.
  assert.match(TASK, /if \(\$z\.Execute -ne \$wscript\) \{ throw/);
  // Pokretač nikad iz foldera stanja.
  assert.doesNotMatch(TASK, /pokreni-skriveno\.js[^\n]*(LOCALAPPDATA|stateDir|folderStanja)/i);
});

test("proba-zadatka.ps1: dva prolaza — izlaz 0 i namerni izlaz 7 moraju stići do Task Scheduler-a", () => {
  assert.match(PROBA, /Proba-Prolaz "--no-warnings `"\$entry`" --packaged --help" 0 '1\/2 izlaz 0'/);
  assert.match(PROBA, /Proba-Prolaz '--no-warnings -e process\.exit\(7\)' 7 '2\/2 izlaz 7'/);
  assert.match(PROBA, /New-ScheduledTaskPrincipal -UserId \$nalog -LogonType Interactive -RunLevel Limited/);
  assert.match(PROBA, /\[ValidateSet\('Skriveno', 'Prozor'\)\] \[string\]\$Prikaz = 'Skriveno'/);
});
