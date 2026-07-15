export const SITE_ACCESS_HANDOFF_STORAGE_KEY = "carsystem-site-access-handoff-v1";
export const SITE_ACCESS_HANDOFF_EVENT = "carsystem:site-access-handoff";
export const SITE_ACCESS_HANDOFF_MAX_AGE_MS = 20_000;
export const SITE_ACCESS_HANDOFF_NAVIGATION_TIMEOUT_MS = 8_000;

export const HOME_HERO_ASSETS = {
  dark: "/images/home/hero-dark.png",
  light: "/images/home/hero-light.png",
} as const;

type SiteAccessHandoff = {
  startedAt: number;
};

export function getActiveHomeHeroSource() {
  return document.documentElement.dataset.theme === "light"
    ? HOME_HERO_ASSETS.light
    : HOME_HERO_ASSETS.dark;
}

export function beginSiteAccessHandoff() {
  const handoff: SiteAccessHandoff = { startedAt: Date.now() };

  try {
    window.sessionStorage.setItem(
      SITE_ACCESS_HANDOFF_STORAGE_KEY,
      JSON.stringify(handoff),
    );
  } catch {
    // The in-document transition still runs if storage is unavailable.
  }

  document.documentElement.dataset.siteAccessHandoff = "starting";
  window.dispatchEvent(new Event(SITE_ACCESS_HANDOFF_EVENT));
}

export function readSiteAccessHandoff() {
  try {
    const raw = window.sessionStorage.getItem(SITE_ACCESS_HANDOFF_STORAGE_KEY);
    if (!raw) return null;

    const handoff = JSON.parse(raw) as Partial<SiteAccessHandoff>;
    const isFresh =
      typeof handoff.startedAt === "number" &&
      Date.now() - handoff.startedAt >= 0 &&
      Date.now() - handoff.startedAt < SITE_ACCESS_HANDOFF_MAX_AGE_MS;

    if (isFresh) return handoff as SiteAccessHandoff;
  } catch {
    // Invalid or unavailable storage is handled by clearing the DOM flag.
  }

  clearSiteAccessHandoff();
  return null;
}

export function clearSiteAccessHandoff() {
  try {
    window.sessionStorage.removeItem(SITE_ACCESS_HANDOFF_STORAGE_KEY);
  } catch {
    // Nothing else is required when sessionStorage is unavailable.
  }

  delete document.documentElement.dataset.siteAccessHandoff;
}

export function waitForActiveHomeHero(maxWaitMs = 1_100) {
  return new Promise<void>((resolve) => {
    const image = new window.Image();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve();
    };

    const timeout = window.setTimeout(finish, maxWaitMs);
    image.decoding = "async";
    image.fetchPriority = "high";
    image.onload = () => {
      if (typeof image.decode === "function") {
        image.decode().then(finish, finish);
        return;
      }

      finish();
    };
    image.onerror = finish;
    image.src = getActiveHomeHeroSource();

    if (image.complete) {
      if (typeof image.decode === "function") {
        image.decode().then(finish, finish);
      } else {
        finish();
      }
    }
  });
}
