/**
 * Portal ne koristi prelaz između stranica.
 *
 * Koreni layout server-renderuje `html[data-route-transition="booting"]` i
 * `body[aria-busy="true"]`, a globalni CSS u tom stanju zaključava skrol
 * (`overflow: hidden` na `html` i `body`). Na javnom sajtu stanje skida
 * mašina prelaza (`useRouteTransition`), ali se ona na `/portal` NE montira
 * (`MotionSystem`). Klijentska navigacija u portal je čista (gašenje mašine
 * briše atribute), ali svako PUNO učitavanje portalske strane — GET forma
 * filtera, osvežavanje, direktan link — ostajalo je zaključano dok rezervni
 * tajmer od 6 s ne bi skinuo stanje. Izgledalo je kao zamrznuta strana.
 */

/** @param {string} pathname */
export function isPortalPath(pathname) {
  return pathname === "/portal" || pathname.startsWith("/portal/");
}

/**
 * Isečak za inline skript u `<head>`: skida stanje pre prvog prikaza.
 * `aria-busy` je na `body`, koji u tom trenutku još ne postoji.
 */
export const PORTAL_ROUTE_TRANSITION_RELEASE = `
    if (path === "/portal" || path.indexOf("/portal/") === 0) {
      delete document.documentElement.dataset.routeTransition;
      var releaseBusy = function () {
        if (document.body) document.body.removeAttribute("aria-busy");
      };
      if (document.body) releaseBusy();
      else document.addEventListener("DOMContentLoaded", releaseBusy, { once: true });
    }
`;

/**
 * Isto, iz React-a — za slučaj da je stanje postavljeno posle skripta.
 * @param {Document} doc
 */
export function releasePortalRouteTransition(doc) {
  delete doc.documentElement.dataset.routeTransition;
  doc.body?.removeAttribute("aria-busy");
}
