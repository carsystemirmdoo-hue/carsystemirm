import type { Map as MapLibreMap } from "maplibre-gl";

/** Srpski nazivi kontrola MapLibre (dugme izvora mape je `summary`, dostupno dodirom i tastaturom). */
export const MAP_ATTRIBUTION_LOCALE = {
  "AttributionControl.ToggleAttribution": "Izvori mape: prikažite ili sakrijte",
} as const;

/** Prag biblioteke za uske mape (AttributionControl: `offsetWidth <= 640`). */
const SMALL_MAP_WIDTH = 640;

/**
 * Sažeti prikaz izvora mape je ugrađen u MapLibre (`attributionControl: { compact: true }`): natpis
 * je pri učitavanju otvoren, a biblioteka ga sažima kada korisnik pomeri mapu. Smernice OSMF-a
 * (Licence/Attribution_Guidelines, „Interactive maps”) dozvoljavaju i automatsko sažimanje posle
 * pet sekundi, uz uslov da licenca ostane dostupna — ostaje, iza dugmeta „i”. Na uskim mapama
 * (telefon) natpis u dva reda zaklanja trećinu mape, pa se posle 5 s sažima istim mehanizmom
 * kojim to radi biblioteka (uklanja `maplibregl-compact-show`); nijedna oznaka se ne briše.
 * Ako je korisnik u međuvremenu sam otvorio ili zatvorio natpis, ne dira se.
 */
export function collapseAttributionOnSmallMap(map: MapLibreMap, delayMs = 5000): () => void {
  const container = map.getContainer();
  let touched = false;
  const onToggle = () => {
    touched = true;
  };
  const button = container.querySelector(".maplibregl-ctrl-attrib-button");
  button?.addEventListener("click", onToggle);
  const timer = window.setTimeout(() => {
    if (touched || container.offsetWidth > SMALL_MAP_WIDTH) return;
    container
      .querySelector(".maplibregl-ctrl-attrib.maplibregl-compact.maplibregl-compact-show")
      ?.classList.remove("maplibregl-compact-show");
  }, delayMs);
  return () => {
    window.clearTimeout(timer);
    button?.removeEventListener("click", onToggle);
  };
}
