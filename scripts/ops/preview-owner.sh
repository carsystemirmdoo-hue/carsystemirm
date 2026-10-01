#!/usr/bin/env bash
# Prvi nalog Vlasnika na TESTNOJ bazi Preview-a — pokreće ga sam Vlasnik.
#
#   bash scripts/ops/preview-owner.sh "<e-adresa za prijavu>" "<ime i prezime>"
#
# - Lozinku kuca Vlasnik, skriveno, dvaput. Ne ide u fajl, istoriju ni ekran.
# - Koristi postojeći `npm run db:seed` (tačno jedan nalog sa ulogom Vlasnik)
#   i `scripts/issue-mfa-enrollment-grant.mjs` (jednokratna dozvola za drugi faktor).
# - Adresa baze i MFA ključ se čitaju iz ~/.carsystem-secrets/preview-test.env;
#   MFA ključ mora biti ISTI kao PORTAL_MFA_MASTER_KEY_V1 u Vercel Preview okruženju.
set -euo pipefail

EMAIL="${1:-}"
NAME="${2:-}"
if [ -z "$EMAIL" ] || [ -z "$NAME" ]; then
  echo "Upotreba: $0 \"<e-adresa za prijavu>\" \"<ime i prezime>\"" >&2
  exit 2
fi

FILE="${CARSYSTEM_SECRETS_DIR:-$HOME/.carsystem-secrets}/preview-test.env"
[ -f "$FILE" ] || { echo "Nema $FILE — prvo: bash scripts/ops/preview-secrets.sh init" >&2; exit 1; }

value() { grep -E "^$1=" "$FILE" | head -1 | cut -d= -f2-; }
OWNER_URL="$(value NEON_OWNER_URL)"
# postgres.js šalje nepoznate parametre adrese serveru; Neonov `channel_binding` bi oborio vezu.
OWNER_URL="$(printf '%s' "$OWNER_URL" | sed -E 's/([?&])channel_binding=[^&]*&?/\1/; s/[?&]$//')"
MFA_KEY="$(value PORTAL_MFA_MASTER_KEY_V1)"
[ -n "$OWNER_URL" ] || { echo "NEON_OWNER_URL nije upisan u $FILE." >&2; exit 1; }
[ -n "$MFA_KEY" ] || { echo "PORTAL_MFA_MASTER_KEY_V1 nije upisan u $FILE." >&2; exit 1; }
case "$OWNER_URL" in
  *.eu-central-1.aws.neon.tech/*) ;;
  *) echo "NEON_OWNER_URL nije Neon u Frankfurtu — odbijeno." >&2; exit 1 ;;
esac

echo "Nalog: $NAME <$EMAIL> (uloga: Vlasnik) — testna baza Preview-a."
printf "Nova lozinka (najmanje 12 znakova, ne prikazuje se): "
read -rs PASSWORD; echo
printf "Ponovite lozinku: "
read -rs CONFIRM; echo
if [ "$PASSWORD" != "$CONFIRM" ]; then echo "Lozinke se ne poklapaju." >&2; exit 1; fi
if [ "${#PASSWORD}" -lt 12 ]; then echo "Lozinka je kraća od 12 znakova." >&2; exit 1; fi
unset CONFIRM

DATABASE_URL="$OWNER_URL" \
BOOTSTRAP_ADMIN_EMAIL="$EMAIL" \
BOOTSTRAP_ADMIN_PASSWORD="$PASSWORD" \
BOOTSTRAP_ADMIN_NAME="$NAME" \
  npm run --silent db:seed
unset PASSWORD

echo
echo "Jednokratna dozvola za vezivanje drugog faktora (prikazuje se samo sada):"
DATABASE_URL="$OWNER_URL" \
PORTAL_MFA_MASTER_KEY_V1="$MFA_KEY" \
MFA_GRANT_EMAIL="$EMAIL" \
  node scripts/issue-mfa-enrollment-grant.mjs
