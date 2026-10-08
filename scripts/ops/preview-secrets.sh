#!/usr/bin/env bash
# Tajne za zaštićeni Preview (testna baza) — fajl VAN repozitorijuma.
#
#   bash scripts/ops/preview-secrets.sh init     # napravi/dopuni fajl, ništa ne ispisuje
#   bash scripts/ops/preview-secrets.sh status   # samo imena: postoji / nedostaje
#   bash scripts/ops/preview-secrets.sh set NEON_OWNER_URL   # unos skriveno, bez ispisa
#   bash scripts/ops/preview-secrets.sh copy DATABASE_URL    # vrednost za Vercel u clipboard, bez ispisa
#
# Fajl: ${CARSYSTEM_SECRETS_DIR:-~/.carsystem-secrets}/preview-test.env, prava 600.
# Postojeća vrednost se nikad ne prepisuje. Vrednosti se nikad ne ispisuju.
# Ključevi su SAMO za Preview; produkcija dobija nove.
set -euo pipefail
umask 077

DIR="${CARSYSTEM_SECRETS_DIR:-$HOME/.carsystem-secrets}"
FILE="$DIR/preview-test.env"

# Generisane vrednosti (base64, 32 bajta = 256 bita).
GENERATED=(AUTH_SECRET PORTAL_MFA_MASTER_KEY_V1 AUTH_RATE_LIMIT_HMAC_KEY CARSYSTEM_APP_PASSWORD SITE_ACCESS_PASSWORD)
# Vrednosti koje unosi čovek (iz Neon i Vercel kontrolne table).
MANUAL=(NEON_OWNER_URL PREVIEW_URL VERCEL_BYPASS_TOKEN)
# Vrednosti koje upisuje scripts/ops/preview-db.mts (korak urls).
DERIVED=(PREVIEW_DATABASE_URL PREVIEW_DATABASE_DIRECT_URL)

has() { grep -q "^$1=." "$FILE" 2>/dev/null; }

gen() {
  # base64url bez dopune: slova, cifre, „-" i „_" — bezbedno u URL-u i u SQL navodnicima.
  openssl rand -base64 32 | tr -d '\n=' | tr '+/' '-_'
}

case "${1:-status}" in
  init)
    umask 077
    mkdir -p "$DIR"
    chmod 700 "$DIR"
    touch "$FILE"
    chmod 600 "$FILE"
    for name in "${GENERATED[@]}"; do
      if ! has "$name"; then
        # Uklanja prazan red istog imena, pa dopisuje novu vrednost.
        grep -v "^$name=" "$FILE" > "$FILE.tmp" || true
        printf '%s=%s\n' "$name" "$(gen)" >> "$FILE.tmp"
        mv "$FILE.tmp" "$FILE"
        chmod 600 "$FILE"
      fi
    done
    for name in "${MANUAL[@]}" "${DERIVED[@]}"; do
      grep -q "^$name=" "$FILE" || printf '%s=\n' "$name" >> "$FILE"
    done
    echo "Fajl: $FILE (prava 600). Vrednosti nisu ispisane."
    "$0" status
    ;;
  set)
    name="${2:-}"
    case " ${MANUAL[*]} " in *" $name "*) ;; *) echo "Dozvoljeno: ${MANUAL[*]}" >&2; exit 2 ;; esac
    [ -f "$FILE" ] || { echo "Prvo: $0 init" >&2; exit 1; }
    printf "Nalepite vrednost za %s (ne prikazuje se) i pritisnite Enter: " "$name"
    read -rs value; echo
    [ -n "$value" ] || { echo "Prazna vrednost — ništa nije upisano." >&2; exit 1; }
    grep -v "^$name=" "$FILE" > "$FILE.tmp" || true
    printf '%s=%s\n' "$name" "$value" >> "$FILE.tmp"
    mv "$FILE.tmp" "$FILE"
    chmod 600 "$FILE"
    unset value
    echo "$name upisan."
    ;;
  copy)
    # Ime je kako ga traži Vercel; vrednost se uzima iz fajla i ide samo u clipboard.
    case "${2:-}" in
      DATABASE_URL) src=PREVIEW_DATABASE_URL ;;
      DATABASE_DIRECT_URL) src=PREVIEW_DATABASE_DIRECT_URL ;;
      AUTH_SECRET|PORTAL_MFA_MASTER_KEY_V1|AUTH_RATE_LIMIT_HMAC_KEY) src="$2" ;;
      *) echo "Dozvoljeno: DATABASE_URL DATABASE_DIRECT_URL AUTH_SECRET PORTAL_MFA_MASTER_KEY_V1 AUTH_RATE_LIMIT_HMAC_KEY" >&2; exit 2 ;;
    esac
    has "$src" || { echo "$src nije upisan u $FILE." >&2; exit 1; }
    grep -E "^$src=" "$FILE" | head -1 | cut -d= -f2- | tr -d '\n' | pbcopy
    echo "$2 je u clipboard-u (nije ispisan). Nalepite ga u Vercel, pa kopirajte nešto drugo."
    ;;
  status)
    if [ ! -f "$FILE" ]; then echo "Fajl ne postoji: $FILE — pokrenite init."; exit 1; fi
    for name in "${GENERATED[@]}" "${MANUAL[@]}" "${DERIVED[@]}"; do
      if has "$name"; then echo "  $name: postoji"; else echo "  $name: NEDOSTAJE"; fi
    done
    ;;
  *)
    echo "Upotreba: $0 init|status|set <IME>|copy <IME>" >&2
    exit 2
    ;;
esac
