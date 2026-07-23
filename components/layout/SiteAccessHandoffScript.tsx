import {
  HOME_HERO_ASSETS,
  SITE_ACCESS_HANDOFF_MAX_AGE_MS,
  SITE_ACCESS_HANDOFF_STORAGE_KEY,
} from "@/lib/site-access-handoff";
import { HEADER_ENTRANCE_STORAGE_KEY } from "@/lib/header-entrance";

const SITE_ACCESS_HANDOFF_SCRIPT = `
(function () {
  try {
    var path = window.location.pathname;
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
