import {
  HOME_HERO_ASSETS,
  SITE_ACCESS_HANDOFF_MAX_AGE_MS,
  SITE_ACCESS_HANDOFF_STORAGE_KEY,
} from "@/lib/site-access-handoff";
import { HEADER_ENTRANCE_STORAGE_KEY } from "@/lib/header-entrance";
import { PORTAL_ROUTE_TRANSITION_RELEASE } from "@/lib/portalRouteTransition.mjs";

const BOOT_FALLBACK_MS = 6000;

const SITE_ACCESS_HANDOFF_SCRIPT = `
(function () {
  /*
   * \`data-js\` kaže CSS-u da JavaScript radi. Bez njega (isključen JS, blokiran
   * inline skript) prekrivač učitavanja i skriveno zaglavlje se uopšte ne
   * prikazuju, pa sadržaj ostaje vidljiv i upotrebljiv.
   */
  document.documentElement.setAttribute("data-js", "");

  /*
   * Last-resort boot protection. The React state machine normally clears the
   * boot phase much earlier. This only runs if hydration or its JS chunk
   * never becomes operational. Registered before anything that can throw:
   * with blocked site data, \`sessionStorage\` throws and the old placement
   * inside the try block left the page covered forever.
   */
  var releaseBoot = function () {
    if (document.documentElement.dataset.routeTransition !== "booting") return;
    document.documentElement.dataset.routeTransition = "fallback";
    if (document.body) document.body.removeAttribute("aria-busy");
  };
  window.setTimeout(releaseBoot, ${BOOT_FALLBACK_MS});

  /*
   * Ne čekati ceo rezervni rok kad je jasno da pokretanje neće uspeti:
   * JS paket nije stigao (proxy, antivirus, prekinuta veza) ili je kod pukao
   * pre nego što je React preuzeo stranicu (npr. API koji stariji pregledač
   * nema). Sadržaj sa servera je tada već tu i treba ga odmah pokazati.
   */
  window.addEventListener("error", function (event) {
    var target = event.target;
    var failedScript = target && target.tagName === "SCRIPT";
    if (failedScript || event.error || event.message) releaseBoot();
  }, true);

  try {
    var path = window.location.pathname;
${PORTAL_ROUTE_TRANSITION_RELEASE}
    var storageKey = ${JSON.stringify(SITE_ACCESS_HANDOFF_STORAGE_KEY)};
    var headerEntranceStorageKey = ${JSON.stringify(HEADER_ENTRANCE_STORAGE_KEY)};
    var maxAge = ${SITE_ACCESS_HANDOFF_MAX_AGE_MS};
    var isMaintenance = path.indexOf("/site-u-pripremi") === 0;
    var raw = window.sessionStorage.getItem(storageKey);

    if (window.sessionStorage.getItem(headerEntranceStorageKey) === "seen") {
      document.documentElement.dataset.headerEntrance = "seen";
    }

    if (isMaintenance) {
      window.sessionStorage.removeItem(storageKey);
      delete document.documentElement.dataset.siteAccessHandoff;
    } else if (raw) {
      var handoff = JSON.parse(raw);
      var age = Date.now() - Number(handoff.startedAt);
      if (Number.isFinite(age) && age >= 0 && age < maxAge) {
        document.documentElement.dataset.siteAccessHandoff = "covered";
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    }

    if (isMaintenance || path === "/") {
      var heroSource = document.documentElement.dataset.theme === "light"
        ? ${JSON.stringify(HOME_HERO_ASSETS.light)}
        : ${JSON.stringify(HOME_HERO_ASSETS.dark)};
      if (!document.querySelector('link[data-cs-home-hero-preload]')) {
        var preload = document.createElement("link");
        preload.rel = "preload";
        preload.as = "image";
        preload.href = heroSource;
        preload.fetchPriority = "high";
        preload.setAttribute("imagesizes", "100vw");
        preload.dataset.csHomeHeroPreload = "true";
        document.head.appendChild(preload);
      }
    }

  } catch (error) {
    delete document.documentElement.dataset.siteAccessHandoff;
  }
})();
`;

export function SiteAccessHandoffScript() {
  return <script dangerouslySetInnerHTML={{ __html: SITE_ACCESS_HANDOFF_SCRIPT }} />;
}
