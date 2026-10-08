import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
const scripts = { podesi: read("./podesi-kopije.ps1"), kopije: read("./kopije.ps1") };

test("Windows skripte kopija: bez preuzimanja, izvršavanja niza, zaobilaženja politike i zakazanih zadataka", () => {
  for (const [name, s] of Object.entries(scripts)) {
    for (const re of [/Invoke-Expression|\biex\b/i, /ExecutionPolicy\s+Bypass/i, /Invoke-WebRequest|Start-BitsTransfer|DownloadFile|curl\b|wget\b/i, /Register-ScheduledTask|schtasks|New-ScheduledTask/i, /Set-MpPreference|Add-MpPreference/i, /\bicacls\b|Set-Acl/i]) {
      assert.ok(!re.test(s), `${name}: ${re}`);
    }
  }
});

test("age.exe se prihvata samo uz SHA-256 zvaničnog izdanja; privatni ključ se odbija", () => {
  assert.match(scripts.podesi, /\$AGE_ZIP_SHA256 = 'f48d8f8f9ebe903ab5027ed067652f2cc1db94bc206976430133b905dcd8e8c7'/);
  assert.match(scripts.podesi, /Get-FileHash .* -Algorithm SHA256/);
  assert.match(scripts.podesi, /AGE-SECRET-KEY.*Stani/s);
});

test("tajne: DPAPI (SecureString), ne ispisuju se, brišu se iz okruženja posle prolaza", () => {
  assert.match(scripts.podesi, /Read-Host .* -AsSecureString/);
  assert.match(scripts.podesi, /ConvertFrom-SecureString -SecureString/);
  assert.ok(!/Write-Host[^\n]*(token|status|Otkljucaj|\$tajne)/i.test(scripts.kopije));
  assert.match(scripts.kopije, /ZeroFreeBSTR/);
  assert.match(scripts.kopije, /Remove-Item Env:\\BACKUP_STATUS_URL, Env:\\GH_BACKUP_TOKEN/);
});

test("fascikla druge kopije ne sme biti unutar izvora PDF-ova", () => {
  assert.match(scripts.podesi, /ne sme biti unutar fascikle sa PDF-ovima/);
});
