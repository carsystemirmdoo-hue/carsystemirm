#!/usr/bin/env bash
# Mesečna RUČNA proba vraćanja šifrovane kopije (Mac). Ne dira izvornu bazu.
#
#   AGE_IDENTITY=<privatni ključ>  RESTORE_ADMIN_URL=postgres://…@127.0.0.1:…/postgres \
#   APP_ENV_FILE=<env aplikacije: AUTH_SECRET, PORTAL_MFA_MASTER_KEY_V1…>  PROBE_CREDS_FILE=<json> \
#   APP_DB_USER=carsystem_app APP_DB_PASSWORD_FILE=<fajl> \
#     bash scripts/backup/restore-drill.sh <kopija.dump.age> <kopija.manifest.json.age> <sha256 otvorene kopije>
#
# Koraci: dešifrovanje → provera otiska → vraćanje u praznu bazu + manifest →
# aplikacija (uloga carsystem_app) nad vraćenom bazom: prijava sa MFA i zbir
# prodaje → brisanje vraćene baze i otvorenih fajlova.
set -euo pipefail
umask 077
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
DUMP_AGE="$1"; MAN_AGE="$2"; DUMP_SHA="$3"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/proba-vracanja.XXXXXX")"
PORT="${APP_PORT:-3432}"
SERVER_PID=""
cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  if [ -f "$WORK/db" ]; then PG_BIN="${PG_BIN:-}" node -e '
    const p=require("postgres"); const s=p(process.env.RESTORE_ADMIN_URL,{max:1,onnotice:()=>{}});
    s.unsafe(`DROP DATABASE IF EXISTS "${require("fs").readFileSync(process.argv[1],"utf8").trim()}" WITH (FORCE)`).finally(()=>s.end());' "$WORK/db" || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT
cd "$REPO"
age --decrypt --identity "$AGE_IDENTITY" --output "$WORK/kopija.dump" "$DUMP_AGE"
age --decrypt --identity "$AGE_IDENTITY" --output "$WORK/kopija.manifest.json" "$MAN_AGE"
[ "$(shasum -a 256 "$WORK/kopija.dump" | cut -d' ' -f1)" = "$DUMP_SHA" ] || { echo "Otisak dešifrovane kopije se ne poklapa." >&2; exit 1; }
echo "dešifrovano i otisak proveren"
node scripts/backup/db-backup.mjs verify --dump "$WORK/kopija.dump" --manifest "$WORK/kopija.manifest.json" --out "$WORK/verify.json" --keep
node -e 'process.stdout.write(require(process.argv[1]).restoredDb)' "$WORK/verify.json" > "$WORK/db"
DB="$(cat "$WORK/db")"
APP_URL_DB="$(node -e '
  const u=new URL(process.env.RESTORE_ADMIN_URL); u.username=process.env.APP_DB_USER;
  u.password=require("fs").readFileSync(process.env.APP_DB_PASSWORD_FILE,"utf8").trim(); u.pathname="/"+process.argv[1]; process.stdout.write(u.toString())' "$DB")"
( set -a; . "$APP_ENV_FILE"; set +a
  DATABASE_URL="$APP_URL_DB" DATABASE_DIRECT_URL="$APP_URL_DB" AUTH_URL="http://127.0.0.1:$PORT" PORTAL_MFA_MODE=enforced \
  exec node node_modules/next/dist/bin/next dev -p "$PORT" -H 127.0.0.1 ) > "$WORK/server.log" 2>&1 &
SERVER_PID=$!
for i in $(seq 1 120); do grep -q "Ready in" "$WORK/server.log" && break; sleep 1; done
APP_URL="http://127.0.0.1:$PORT" node scripts/backup/app-check.mjs --manifest "$WORK/kopija.manifest.json"
echo "PROBA VRAĆANJA USPEŠNA"
