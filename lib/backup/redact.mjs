/**
 * Uklanjanje tajni iz teksta pre ispisa (logovi alata za kopije).
 *
 * Alati za kopije nikad ne primaju tajnu kao argument (adrese baza i ključevi
 * idu kroz okruženje), ali poruke grešaka biblioteka mogu da ponove adresu.
 * Zato SVAKI ispis prolazi kroz `redact`.
 */

const PATTERNS = [
  // postgres://korisnik:lozinka@host/baza → postgres://***@host/baza
  [/\b(postgres(?:ql)?:\/\/)[^\s@/]+@/gi, "$1***@"],
  // AGE-SECRET-KEY-1...
  [/AGE-SECRET-KEY-1[0-9A-Z]+/g, "AGE-SECRET-KEY-***"],
  // GitHub tokeni
  [/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]{10,}/g, "$1***"],
  // password=... u nizu parametara
  [/(password|passwd|pwd)=([^\s&;]+)/gi, "$1=***"],
];

/** @param {unknown} text */
export function redact(text, extraSecrets = []) {
  let s = String(text ?? "");
  for (const secret of extraSecrets) {
    if (secret && String(secret).length >= 6) s = s.split(String(secret)).join("***");
  }
  for (const [re, rep] of PATTERNS) s = s.replace(re, rep);
  return s;
}

/** Logger koji redigovanje radi uvek, bez obzira na to ko poziva. */
export function makeLogger(write = (line) => process.stdout.write(line + "\n"), extraSecrets = () => []) {
  return (...parts) => write(redact(parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" "), extraSecrets()));
}
