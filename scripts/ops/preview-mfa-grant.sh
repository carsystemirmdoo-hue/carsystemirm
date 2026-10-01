#!/usr/bin/env bash
# Jednokratna dozvola za vezivanje drugog faktora — kod se NE ispisuje.
#
#   bash scripts/ops/preview-mfa-grant.sh issue "<e-adresa Vlasnika>"
#   bash scripts/ops/preview-mfa-grant.sh clear
#
# `issue` izdaje novu dozvolu (prethodna neiskorišćena se automatski poništava)
# i upisuje kod u ~/.carsystem-secrets/owner-mfa-grant.txt (prava 600). Kod
# preuzima sam Vlasnik, lokalno, i unosi ga samo na stranici za vezivanje na
# Preview-u. Kod važi 30 minuta — izdaje se tek kada je Preview dostupan.
# `clear` briše fajl posle upotrebe.
set -euo pipefail
umask 077

DIR="${CARSYSTEM_SECRETS_DIR:-$HOME/.carsystem-secrets}"
FILE="$DIR/preview-test.env"
OUT="$DIR/owner-mfa-grant.txt"

case "${1:-}" in
  issue)
    EMAIL="${2:-}"
    [ -n "$EMAIL" ] || { echo "Upotreba: $0 issue \"<e-adresa Vlasnika>\"" >&2; exit 2; }
    [ -f "$FILE" ] || { echo "Nema $FILE." >&2; exit 1; }
    value() { grep -E "^$1=" "$FILE" | head -1 | cut -d= -f2-; }
    OWNER_URL="$(value NEON_OWNER_URL | sed -E 's/([?&])channel_binding=[^&]*&?/\1/; s/[?&]$//')"
    MFA_KEY="$(value PORTAL_MFA_MASTER_KEY_V1)"
    case "$OWNER_URL" in
      *-pooler.*) echo "NEON_OWNER_URL je pooled — odbijeno." >&2; exit 1 ;;
      *.eu-central-1.aws.neon.tech/*) ;;
      *) echo "NEON_OWNER_URL nije Neon u Frankfurtu — odbijeno." >&2; exit 1 ;;
    esac
    if DATABASE_URL="$OWNER_URL" PORTAL_MFA_MASTER_KEY_V1="$MFA_KEY" MFA_GRANT_EMAIL="$EMAIL" \
         node scripts/issue-mfa-enrollment-grant.mjs > "$OUT" 2>/dev/null; then
      chmod 600 "$OUT"
      echo "Dozvola izdata. Kod NIJE ispisan; nalazi se u: $OUT (prava 600)."
      echo "Vlasnik ga otvara sam (npr. open -e \"$OUT\"), unosi samo na /portal/bezbednost/mfa"
      echo "na Preview-u, u roku od 30 minuta, i NE kopira ga u chat ni poruku."
      echo "Posle upotrebe: bash $0 clear"
    else
      rm -f "$OUT"
      echo "Dozvola nije izdata (nalog ili ključ ne odgovara)." >&2
      exit 1
    fi
    ;;
  clear)
    rm -f "$OUT"
    echo "Fajl sa kodom je obrisan."
    ;;
  *)
    echo "Upotreba: $0 issue \"<e-adresa Vlasnika>\" | clear" >&2
    exit 2
    ;;
esac
