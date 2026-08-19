/**
 * Stanje custom kursora (pigment orb), odvojeno od DOM klasifikacije cilja.
 *
 * Šta je ovde stvarno bilo slomljeno:
 *
 *   1. Hover stanje je bilo isključivo funkcija poslednjeg `pointermove`
 *      događaja. Kada bi element ispod nepomičnog kursora nestao ili se
 *      promenio (skrol, zatvaranje panela, rerender), orb je ostajao u starom
 *      izgledu vezanom za DOM čvor koji više ne postoji.
 *   2. Reset je postojao samo za `pointerleave` nad dokumentom. Izlazak iz
 *      prozora preko druge aplikacije, `pointercancel`, `blur`,
 *      `visibilitychange` i `pagehide` nisu vraćali orb u neutralno stanje, pa
 *      se po povratku zaticao vidljiv orb na staroj poziciji.
 *   3. Animacija je imala sopstvenu RAF petlju, nezavisnu od ostalih pointer
 *      potrošača.
 *
 * Runtime sada ima jedan ulaz po događaju, jedan zajednički frame (kroz
 * `pointerLifecycle`) i jedno pravilo za neutralno stanje. Koordinata se uvek
 * čita iz zajedničkog objekta, pa nema zastarelog closure-a niti reda
 * zaostalih animacija — nova pozicija zamenjuje staru.
 *
 * Plain JS (ne TS): ugovor vozi `node --test`. `pigmentCursorRuntime.ts` je
 * tipizovan omotač.
 */

import { registerPointerConsumer } from "./pointerLifecycle.mjs";

export const HALO_EASE = 0.16;
export const DOT_EASE = 0.36;
/** Ispod ovoga se pozicija smatra dostignutom i frame se ne zakazuje ponovo. */
export const SETTLE_EPSILON = 0.1;
export const NEUTRAL_STATE = "default";
export const CURSOR_ENABLED_CLASS = "cs-pigment-cursor-enabled";

/**
 * `halo` i `dot` su elementi orba; `env` nosi DOM površinu, `matchMedia`,
 * `bodyClassList` i dva razrešivača stanja (iz događaja i iz koordinate).
 * Tipovi su u `pigmentCursorRuntime.ts`.
 */
export function createPigmentCursorRuntime({
  halo,
  dot,
  env,
  mediaQuery = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
}) {
  const media = env.matchMedia(mediaQuery);
  const center = env.viewportCenter?.() ?? { x: 0, y: 0 };
  const target = { x: center.x, y: center.y };
  const haloPosition = { ...target };
  const dotPosition = { ...target };

  let enabled = false;
  let visible = false;
  let stateKey = "";
  /** Element na kome hover stanje trenutno visi — proverava se pri refresh-u. */
  let hoverElement = null;
  let released = false;
  let registration = null;

  function applyState(state, process, element) {
    const nextKey = `${state}:${process}`;
    hoverElement = element ?? null;
    if (nextKey === stateKey) return;

    stateKey = nextKey;
    halo.dataset.state = state;
    dot.dataset.state = state;
    halo.dataset.process = process;
    dot.dataset.process = process;
  }

  function resetState() {
    applyState(NEUTRAL_STATE, "", null);
  }

  function setVisible(next) {
    if (visible === next) return;
    visible = next;
    halo.dataset.visible = next ? "true" : "false";
    dot.dataset.visible = next ? "true" : "false";
    if (next) registration?.requestFrame();
    else registration?.cancelFrame();
  }

  function setEnabled(next) {
    enabled = next;
    if (next) env.bodyClassList.add(CURSOR_ENABLED_CLASS);
    else env.bodyClassList.remove(CURSOR_ENABLED_CLASS);
    halo.dataset.enabled = next ? "true" : "false";
    dot.dataset.enabled = next ? "true" : "false";
    if (!next) {
      setVisible(false);
      resetState();
    }
  }

  function handlePointerMove(event) {
    if (!enabled) return;
    if (event.pointerType && event.pointerType !== "mouse") return;

    target.x = event.clientX;
    target.y = event.clientY;
    const resolved = env.resolveStateFromEvent(event);
    applyState(resolved.state, resolved.process, resolved.element);
    setVisible(true);
    registration?.requestFrame();
  }

  /*
   * Cilj ispod kursora se mogao promeniti bez ijednog pomeraja miša. Hit-test
   * ide kroz poslednju poznatu koordinatu i dešava se najviše jednom po
   * frame-u — bez posmatranja DOM stabla i bez posla po scroll događaju.
   */
  function handlePointerRefresh(point) {
    if (!enabled || !visible) return;
    if (hoverElement && hoverElement.isConnected === false) {
      resetState();
    }
    const resolved = env.resolveStateFromPoint(point);
    applyState(resolved.state, resolved.process, resolved.element);
  }

  function handleReset() {
    setVisible(false);
    resetState();
  }

  function handleFrame() {
    if (!enabled || !visible) return;

    haloPosition.x += (target.x - haloPosition.x) * HALO_EASE;
    haloPosition.y += (target.y - haloPosition.y) * HALO_EASE;
    dotPosition.x += (target.x - dotPosition.x) * DOT_EASE;
    dotPosition.y += (target.y - dotPosition.y) * DOT_EASE;

    halo.style.transform = `translate3d(${haloPosition.x}px, ${haloPosition.y}px, 0) translate(-50%, -50%)`;
    dot.style.transform = `translate3d(${dotPosition.x}px, ${dotPosition.y}px, 0) translate(-50%, -50%)`;

    const remainingDistance = Math.max(
      Math.abs(target.x - haloPosition.x),
      Math.abs(target.y - haloPosition.y),
      Math.abs(target.x - dotPosition.x),
      Math.abs(target.y - dotPosition.y),
    );
    if (remainingDistance > SETTLE_EPSILON) registration?.requestFrame();
  }

  function updateEnabled() {
    setEnabled(Boolean(media.matches));
  }

  /*
   * Deterministično početno stanje: skriven orb u neutralnom izgledu. Bez ovoga
   * su `data-visible` i `data-state` postojali tek posle prvog pomeraja miša,
   * pa je na coarse-pointer uređajima (gde pomeraja nema) orb ostajao u
   * nedefinisanom stanju.
   */
  halo.dataset.visible = "false";
  dot.dataset.visible = "false";
  resetState();

  registration = registerPointerConsumer(
    {
      onPointerMove: handlePointerMove,
      onPointerRefresh: handlePointerRefresh,
      onReset: handleReset,
      onFrame: handleFrame,
    },
    env,
  );

  media.addEventListener("change", updateEnabled);
  updateEnabled();

  return {
    destroy() {
      if (released) return;
      released = true;
      media.removeEventListener("change", updateEnabled);
      setEnabled(false);
      registration?.release();
      registration = null;
    },
    /** Test-only pogled na stanje orba. */
    stats() {
      return {
        enabled,
        visible,
        stateKey,
        hoverElement,
        target: { ...target },
        haloPosition: { ...haloPosition },
        dotPosition: { ...dotPosition },
      };
    },
  };
}
