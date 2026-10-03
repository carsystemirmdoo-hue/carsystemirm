/**
 * Čitanje i dopuna fajla sa tajnama za Preview (scripts/ops/preview-secrets.sh).
 * Vrednosti se nikad ne ispisuju; greške imenuju samo promenljivu.
 */
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export const SECRETS_FILE = path.join(
  process.env.CARSYSTEM_SECRETS_DIR || path.join(homedir(), ".carsystem-secrets"),
  "preview-test.env",
);

export function readSecrets(file = SECRETS_FILE): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

export function requireSecret(secrets: Record<string, string>, name: string): string {
  const value = secrets[name];
  if (!value) {
    throw new Error(`${name} nije upisan u ${SECRETS_FILE} (vidi docs/b2b/33-test-baza-runbook.md).`);
  }
  return value;
}

/** Upisuje ili zamenjuje jednu vrednost; prava fajla ostaju 600. */
export function writeSecret(name: string, value: string, file = SECRETS_FILE): void {
  const lines = readFileSync(file, "utf8").split("\n").filter((l) => l !== "" && !l.startsWith(`${name}=`));
  lines.push(`${name}=${value}`);
  writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
  chmodSync(file, 0o600);
}
