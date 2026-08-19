/**
 * Vlasništvo nad temom Headera dok traje paint takeover.
 *
 * Ranije je ovo bilo izvedeno iz dve stvari koje nisu geometrija sekcije:
 *
 *   1. `CHAPTER_FLOOR` — chapter signal se posle izlaska nije vraćao na nulu
 *      nego na 0.34, pa je Header (i section rail, i orb) ostajao delimično u
 *      "tamnom poglavlju" do kraja stranice i posle reload-a.
 *   2. state mašina (`before → entering → active → leaving → after`) sa
 *      histerezom nad `progress`-om, koja pamti prethodno stanje. Pri skoku
 *      preko granice (Back/Forward, hash skok, veliki scroll korak) rezultat je
 *      zavisio od toga odakle se došlo, a ne od toga gde je sekcija.
 *
 * Sada postoji jedna probe linija — donja ivica sticky Headera — i jedno
 * pravilo: Header je taman dok ta linija stoji unutar sekcije. To je čista
 * funkcija trenutne geometrije, pa je isti rezultat za skrol nadole, skrol
 * nagore, skok, reload i resize. Nema smera, nema zapamćenog stanja.
 *
 * `ramp` postoji samo da prelaz ne bude jedan tvrd frame: signal se izvodi iz
 * piksela skrola oko granice, dakle i dalje je funkcija pozicije, ne vremena.
 *
 * Plain JS (ne TS) iz istog razloga kao `productSurfaceLifecycle.mjs`: ugovor
 * vozi `node --test` nad stvarnim brojevima, pa mora postojati tačno jedna
 * implementacija. `paintTakeoverChrome.ts` je samo tipizovan omotač.
 */

/** Rezerva kada Header još nije izmeren (SSR hidracija, sakriven header). */
export const HEADER_PROBE_FALLBACK = 88;

/**
 * Preko koliko piksela skrola oko granice sekcije se chapter signal izvodi iz
 * 0 u 1. Kratko — wipe tamne površine je do dolaska sekcije pod Header već
 * skoro završen, pa duži ramp znači svetao Header nad tamnim kadrom.
 */
export const CHAPTER_RAMP_PX = 120;

function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Probe linija: donja ivica sticky Headera u viewport koordinatama.
 *
 * Ulaz je VISINA Headera, a ne njegova trenutna pozicija. Header se pri skrolu
 * nadole sklanja (`data-scroll-hidden`), pa bi merena donja ivica bila
 * negativna i probe linija bi zavisila od smera skrola.
 *
 * @param {number|null|undefined} headerHeight
 * @returns {number}
 */
export function probeLineFor(headerHeight) {
  if (typeof headerHeight !== "number" || !Number.isFinite(headerHeight)) {
    return HEADER_PROBE_FALLBACK;
  }
  if (headerHeight <= 0) return HEADER_PROBE_FALLBACK;
  return headerHeight;
}

/**
 * @param {{
 *   sectionTop: number,
 *   sectionBottom: number,
 *   probeLine: number,
 *   ramp?: number,
 * }} input
 * @returns {{ chapter: number, owned: boolean, phase: "before"|"entering"|"active"|"leaving"|"after" }}
 */
export function resolveTakeoverChrome({
  sectionTop,
  sectionBottom,
  probeLine,
  ramp = CHAPTER_RAMP_PX,
}) {
  const safeRamp = Math.max(1, ramp);
  /** Koliko je gornja ivica prošla ispod probe linije. */
  const entered = clamp01((probeLine - sectionTop) / safeRamp);
  /** Koliko je donja ivica još ispod probe linije. */
  const remaining = clamp01((sectionBottom - probeLine) / safeRamp);
  const chapter = Math.min(entered, remaining);
  const owned = sectionTop <= probeLine && sectionBottom > probeLine;

  let phase;
  if (!owned) {
    phase = sectionTop > probeLine ? "before" : "after";
  } else if (remaining < 1) {
    phase = "leaving";
  } else if (entered < 1) {
    phase = "entering";
  } else {
    phase = "active";
  }

  return { chapter, owned, phase };
}

export const ACTIVE_ATTRIBUTE = "data-paint-takeover";
export const CHAPTER_VARIABLE = "--paint-chapter";

/**
 * Vlasništvo nad `<html>` chrome stanjem.
 *
 * Jedno mesto koje ume da postavi i da POTPUNO otpusti temu. `clear()` ne
 * ostavlja nikakav ostatak — ranije je ostajao prag chapter signala, pa je
 * Header i posle unmount-a, route promene i `pagehide`-a nosio deo tamne teme.
 *
 * `root` je element-like: `setAttribute`, `removeAttribute` i `style` sa
 * `setProperty`/`removeProperty`.
 */
export function createChromeOwnership({ root, enabled = true }) {
  let current = null;

  return {
    /** @param {{chapter: number, owned: boolean, phase: string}} chrome */
    sync(chrome) {
      root.style.setProperty(CHAPTER_VARIABLE, chrome.chapter.toFixed(4));
      if (!enabled) return;

      const next = chrome.owned ? chrome.phase : null;
      if (next === current) return;
      current = next;
      if (next) root.setAttribute(ACTIVE_ATTRIBUTE, next);
      else root.removeAttribute(ACTIVE_ATTRIBUTE);
    },
    clear() {
      current = null;
      root.removeAttribute(ACTIVE_ATTRIBUTE);
      root.style.removeProperty(CHAPTER_VARIABLE);
    },
    /** Test-only pogled na trenutno vlasništvo. */
    state() {
      return current;
    },
  };
}
