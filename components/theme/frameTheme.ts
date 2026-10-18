/**
 * Tema okvira sajta (2026-10-17).
 *
 * Dva odvojena stanja na <html>:
 *  - `data-theme-preference` — trajni izbor korisnika (localStorage "theme" ili
 *    sistemska postavka). Menja ga samo prekidač teme.
 *  - `.dark` + `data-theme` — EFEKTIVNA tema koju čitaju svi stilovi. Jednaka je
 *    izboru korisnika, osim dok je istaknuta sekcija aktivna u prikazu
 *    (`data-frame-theme` na sekciji); tada `data-frame-theme` na <html> nosi
 *    privremenu temu, a header, navigacija brenda, meniji i pozadina je prate.
 *
 * Privremena tema se nikad ne upisuje u localStorage.
 */
export type SiteTheme = "light" | "dark";
/** Vrednost na sekciji: fiksna tema ili `inverse` (suprotno od izbora korisnika). */
export type FrameThemeRequest = SiteTheme | "inverse";

export const THEME_STORAGE_KEY = "theme";
export const THEME_PREFERENCE_EVENT = "cs-theme-preference";

function root() {
  return document.documentElement;
}

export function readThemePreference(): SiteTheme {
  const value = root().dataset.themePreference;
  if (value === "dark" || value === "light") return value;
  return root().classList.contains("dark") ? "dark" : "light";
}

export function resolveFrameTheme(
  request: FrameThemeRequest | null | undefined,
  preference: SiteTheme,
): SiteTheme | null {
  if (request === "dark" || request === "light") return request === preference ? null : request;
  if (request === "inverse") return preference === "dark" ? "light" : "dark";
  return null;
}

/** Usklađuje `.dark`/`data-theme` sa izborom korisnika i aktivnom privremenom temom. */
export function applyEffectiveTheme() {
  const html = root();
  const preference = readThemePreference();
  const frame = html.dataset.frameTheme;
  const effective: SiteTheme = frame === "dark" || frame === "light" ? frame : preference;
  if (html.classList.contains("dark") !== (effective === "dark")) {
    html.classList.toggle("dark", effective === "dark");
  }
  if (html.dataset.theme !== effective) html.dataset.theme = effective;
}

let switchTimer: number | undefined;

/**
 * Menja privremenu temu okvira. Sa `animate` se boje (pozadina, tekst, obrubi)
 * kratko pretapaju (~240 ms, `html[data-frame-switching]` u globals.css)
 * umesto naglog fleša. Bez snimaka slojeva (View Transitions su davale
 * dvostruku sliku pri brzom skrolu). Uz smanjeno kretanje promena je neposredna.
 */
export function setFrameTheme(theme: SiteTheme | null, options: { animate?: boolean } = {}) {
  const html = root();
  const current = html.dataset.frameTheme ?? null;
  if (current === theme) return;

  const effectiveBefore = html.classList.contains("dark");
  const effectiveAfter = (theme ?? readThemePreference()) === "dark";
  if (
    options.animate &&
    effectiveBefore !== effectiveAfter &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    html.dataset.frameSwitching = "";
    window.clearTimeout(switchTimer);
    switchTimer = window.setTimeout(() => {
      delete html.dataset.frameSwitching;
    }, 320);
  }

  if (theme) html.dataset.frameTheme = theme;
  else delete html.dataset.frameTheme;
  applyEffectiveTheme();
}

export function setThemePreference(next: SiteTheme) {
  root().dataset.themePreference = next;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    // localStorage nije dostupan; izbor važi do kraja posete.
  }
  window.dispatchEvent(new CustomEvent(THEME_PREFERENCE_EVENT, { detail: next }));
}
