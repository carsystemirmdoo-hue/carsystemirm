#!/usr/bin/env bash
# Rezervna kopija pilot baze i proba vraćanja — lozinka ide kroz okruženje, ne kroz argumente.
#
#   CARSYSTEM_SECRETS_DIR=~/.carsystem-secrets/pilot bash scripts/ops/pilot-backup.sh dump <fascikla>
#   RESTORE_TEST_URL=postgres://<korisnik>@127.0.0.1:<port>/postgres \
#     bash scripts/ops/pilot-backup.sh verify <fascikla>/<fajl>.dump
#
# dump: pg_dump -Fc sa DIREKTNE adrese vlasnika (Neon, Frankfurt) u fasciklu van
#       repozitorijuma, na šifrovanom disku (FileVault); uz fajl ide .json sa
#       SHA-256 i brojem redova ključnih tabela. Dump sadrži heševe lozinki i
#       šifrovane MFA tajne — fajl je 600 i ne napušta računar.
# verify: vraća dump u privremenu LOKALNU bazu, poredi broj redova sa .json i
#       briše privremenu bazu. Ne dira Neon.
set -euo pipefail
umask 077
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@17/bin}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
COUNTS_SQL="SELECT json_build_object(
  'users',(SELECT count(*) FROM users),'customers',(SELECT count(*) FROM customers),
  'customer_external_identifiers',(SELECT count(*) FROM customer_external_identifiers),
  'source_documents',(SELECT count(*) FROM source_documents),'source_document_lines',(SELECT count(*) FROM source_document_lines),
  'invoices',(SELECT count(*) FROM invoices),'invoice_lines',(SELECT count(*) FROM invoice_lines),
  'audit_log',(SELECT count(*) FROM audit_log),'migracije',(SELECT count(*) FROM drizzle.__drizzle_migrations))"

case "${1:-}" in
  dump)
    OUT="${2:-}"; [ -n "$OUT" ] || { echo "Upotreba: $0 dump <fascikla>" >&2; exit 2; }
    OUT="$(python3 -c 'import os,sys; print(os.path.abspath(os.path.expanduser(sys.argv[1])))' "$OUT")"
    case "$OUT/" in "$REPO"/*) echo "Fascikla je u repozitorijumu — odbijeno." >&2; exit 1;; esac
    mkdir -p "$OUT"
    fdesetup status 2>/dev/null | grep -q "FileVault is On" || { echo "FileVault nije uključen — kopija se ne pravi." >&2; exit 1; }
    FILE="${CARSYSTEM_SECRETS_DIR:-$HOME/.carsystem-secrets}/preview-test.env"
    grep -q '^DATASET_ROLE=pilot$' "$FILE" || { echo "Fajl tajni nije označen kao pilot — odbijeno." >&2; exit 1; }
    eval "$(python3 - "$FILE" <<'PY'
import sys, shlex, urllib.parse
v=[l.split('=',1)[1].strip() for l in open(sys.argv[1]) if l.startswith('NEON_OWNER_URL=')][0]
u=urllib.parse.urlparse(v)
assert u.hostname.endswith('.eu-central-1.aws.neon.tech') and '-pooler' not in u.hostname, 'meta nije direktna Neon adresa u Frankfurtu'
for k,val in [('PGHOST',u.hostname),('PGPORT',str(u.port or 5432)),('PGUSER',urllib.parse.unquote(u.username)),('PGPASSWORD',urllib.parse.unquote(u.password)),('PGDATABASE',u.path.lstrip('/')),('PGSSLMODE','require')]:
    print(f"export {k}={shlex.quote(val)}")
PY
)"
    STAMP="$(date +%Y%m%d-%H%M%S)"; DUMP="$OUT/carsystem-pilot-$STAMP.dump"
    "$PG_BIN/pg_dump" -Fc --no-owner --no-privileges -f "$DUMP"
    COUNTS="$("$PG_BIN/psql" -Atc "$COUNTS_SQL")"
    SHA="$(shasum -a 256 "$DUMP" | cut -d' ' -f1)"
    printf '{"fajl":"%s","sha256":"%s","napravljeno":"%s","redovi":%s}\n' "$(basename "$DUMP")" "$SHA" "$STAMP" "$COUNTS" > "$DUMP.json"
    chmod 600 "$DUMP" "$DUMP.json"
    echo "Kopija napravljena ($(du -h "$DUMP" | cut -f1)); otisak i broj redova u .json. Putanja: $DUMP"
    ;;
  verify)
    DUMP="${2:-}"; [ -f "$DUMP" ] && [ -f "$DUMP.json" ] || { echo "Upotreba: $0 verify <fajl.dump> (uz <fajl.dump>.json)" >&2; exit 2; }
    [ -n "${RESTORE_TEST_URL:-}" ] || { echo "Postavite RESTORE_TEST_URL na LOKALNI Postgres (127.0.0.1)." >&2; exit 1; }
    case "$RESTORE_TEST_URL" in *@127.0.0.1:*|*@localhost:*) ;; *) echo "Proba vraćanja radi samo nad lokalnom bazom." >&2; exit 1;; esac
    SHA="$(shasum -a 256 "$DUMP" | cut -d' ' -f1)"
    python3 -c "import json,sys; d=json.load(open(sys.argv[1])); sys.exit(0 if d['sha256']==sys.argv[2] else 1)" "$DUMP.json" "$SHA" \
      || { echo "Otisak kopije se ne poklapa sa .json — kopija je promenjena." >&2; exit 1; }
    TMPDB="restore_check_$(date +%s)"
    "$PG_BIN/psql" "$RESTORE_TEST_URL" -qc "CREATE DATABASE $TMPDB"
    trap '"$PG_BIN/psql" "$RESTORE_TEST_URL" -qc "DROP DATABASE IF EXISTS $TMPDB" >/dev/null 2>&1 || true' EXIT
    TARGET="${RESTORE_TEST_URL%/*}/$TMPDB"
    "$PG_BIN/pg_restore" -d "$TARGET" --no-owner --no-privileges --exit-on-error "$DUMP"
    GOT="$("$PG_BIN/psql" "$TARGET" -Atc "$COUNTS_SQL")"
    python3 - "$DUMP.json" "$GOT" <<'PY'
import json, sys
want=json.load(open(sys.argv[1]))['redovi']; got=json.loads(sys.argv[2])
bad=[k for k in want if want[k]!=got.get(k)]
print('Vraćanje: broj redova se poklapa u svih', len(want), 'tabela.' if not bad else f'RAZLIKA u: {", ".join(bad)}')
sys.exit(1 if bad else 0)
PY
    ;;
  *) echo "Upotreba: $0 dump <fascikla> | verify <fajl.dump>" >&2; exit 2;;
esac
