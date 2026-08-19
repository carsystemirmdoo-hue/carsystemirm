import assert from "node:assert/strict";
import test from "node:test";
import {
  parseSidebarState,
  reclaimedWidth,
  serializeSidebarState,
  SIDEBAR_COOKIE,
  sidebarCookieValue,
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  sidebarWidth,
  toggleSidebar,
} from "./sidebarState.mjs";

test("širine odgovaraju dizajnu: ~252px prošireno, 56–68px skupljeno", () => {
  assert.equal(SIDEBAR_WIDTH_EXPANDED, 252);
  assert.ok(SIDEBAR_WIDTH_COLLAPSED >= 56 && SIDEBAR_WIDTH_COLLAPSED <= 68);
  assert.equal(sidebarWidth(false), SIDEBAR_WIDTH_EXPANDED);
  assert.equal(sidebarWidth(true), SIDEBAR_WIDTH_COLLAPSED);
});

test("skupljanjem tabele dobijaju celu oslobođenu širinu", () => {
  assert.equal(reclaimedWidth(), SIDEBAR_WIDTH_EXPANDED - SIDEBAR_WIDTH_COLLAPSED);
  assert.equal(reclaimedWidth(), 188);
});

test("stanje preživljava zapis i čitanje iz kolačića", () => {
  assert.equal(parseSidebarState(serializeSidebarState(true)), true);
  assert.equal(parseSidebarState(serializeSidebarState(false)), false);
});

test("nepoznata ili nedostajuća vrednost znači prošireno", () => {
  assert.equal(parseSidebarState(undefined), false);
  assert.equal(parseSidebarState(null), false);
  assert.equal(parseSidebarState(""), false);
  assert.equal(parseSidebarState("nesto"), false);
});

test("kolačić traje dugo i ne šalje se na strane zahteve", () => {
  const value = sidebarCookieValue(true);
  assert.ok(value.startsWith(`${SIDEBAR_COOKIE}=collapsed`));
  assert.ok(value.includes("Path=/"));
  assert.ok(value.includes("SameSite=Lax"));
  assert.ok(/Max-Age=\d{7,}/.test(value));
});

test("prebacivanje menja samo navigaciju — strana, filteri i skrol ostaju", () => {
  const state = {
    collapsed: false,
    route: "/portal/kupci",
    filter: "preko limita",
    sort: "naziv-asc",
    page: 3,
    selected: ["kupac-1", "kupac-2"],
    scrollTop: 420,
  };

  const next = toggleSidebar(state);

  assert.equal(next.collapsed, true);
  assert.equal(next.route, state.route);
  assert.equal(next.filter, state.filter);
  assert.equal(next.sort, state.sort);
  assert.equal(next.page, state.page);
  assert.deepEqual(next.selected, state.selected);
  assert.equal(next.scrollTop, state.scrollTop);
  // Ulazno stanje ostaje netaknuto.
  assert.equal(state.collapsed, false);
});

test("dvostruko prebacivanje vraća polazno stanje", () => {
  const state = { collapsed: false, page: 2 };
  assert.deepEqual(toggleSidebar(toggleSidebar(state)), state);
});
