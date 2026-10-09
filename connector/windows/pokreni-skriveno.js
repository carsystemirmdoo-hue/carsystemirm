// Carsystem konektor - pokrece node.exe BEZ konzolnog prozora i vraca NJEGOV izlazni kod.
//
// Poziva ga Task Scheduler (task.ps1 -Prikaz Skriveno):
//   %SystemRoot%\System32\wscript.exe //B //NoLogo "<paket>\windows\pokreni-skriveno.js" "<...\node.exe>" <argumenti>
//
// - wscript.exe je Windows program bez konzole; node.exe se pokrece sa skrivenim prozorom (Run, 0)
//   i skripta CEKA kraj (true), pa WScript.Quit prenosi tacan izlazni kod u "Last Run Result".
// - Fajl je u INSTALACIONOM folderu (pisanje samo Administrators/SYSTEM), nikad u folderu stanja.
// - Nalog, RunLevel, radni direktorijum, DPAPI kljuc, red i log se ne menjaju: to je isti node.exe
//   sa istim argumentima kao kod direktne akcije.
// - Kodovi samog pokretaca (ne konektora): 87 = neispravni argumenti, 86 = node.exe nije pokrenut.
var a = WScript.Arguments;
if (a.length < 2) WScript.Quit(87);
var exe = a(0);
if (!/^[A-Za-z]:\\[^"*?<>|]*\\node\.exe$/i.test(exe)) WScript.Quit(87);
function navodnici(s) {
  if (s.indexOf('"') >= 0 || /\\$/.test(s)) WScript.Quit(87);
  return (s === "" || /\s/.test(s)) ? '"' + s + '"' : s;
}
var delovi = [navodnici(exe)];
for (var i = 1; i < a.length; i++) delovi.push(navodnici(a(i)));
var kod;
try {
  kod = new ActiveXObject("WScript.Shell").Run(delovi.join(" "), 0, true);
} catch (e) {
  WScript.Quit(86);
}
WScript.Quit(kod);
