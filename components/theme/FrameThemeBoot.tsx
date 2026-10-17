/**
 * Inline skript posle istaknute sekcije na vrhu stranice (hero). Primenjuje
 * isto pravilo kao FrameThemeController (linija na 42 % visine ekrana) dok se
 * HTML još parsira, pa header ne trepne iz teme korisnika u temu sekcije pre
 * učitavanja Reacta. Kontroler posle preuzima i daje isti rezultat.
 */
const FRAME_THEME_BOOT = `
(function () {
  try {
    var html = document.documentElement;
    var pref = html.dataset.themePreference || (html.classList.contains("dark") ? "dark" : "light");
    var probe = window.innerHeight * 0.42;
    var zones = document.querySelectorAll("[data-frame-theme]");
    for (var i = 0; i < zones.length; i++) {
      var rect = zones[i].getBoundingClientRect();
      if (rect.height > 0 && rect.top <= probe && rect.bottom > probe) {
        var request = zones[i].getAttribute("data-frame-theme");
        var theme = request === "inverse" ? (pref === "dark" ? "light" : "dark") : request;
        if (theme === "dark" || theme === "light") {
          if (theme !== pref) html.dataset.frameTheme = theme;
          html.classList.toggle("dark", theme === "dark");
          html.dataset.theme = theme;
        }
        break;
      }
    }
  } catch (error) {}
})();
`;

export function FrameThemeBoot() {
  return <script dangerouslySetInnerHTML={{ __html: FRAME_THEME_BOOT }} />;
}
