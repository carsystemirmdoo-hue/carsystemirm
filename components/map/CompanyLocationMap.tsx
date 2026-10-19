"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { companyLocation } from "@/lib/company-contact";
import { collapseAttributionOnSmallMap, MAP_ATTRIBUTION_LOCALE } from "@/components/map/map-attribution";
import {
  loadCarsystemMapStyle,
  observeSiteTheme,
  startMapWhenNear,
  swapCarsystemMapTheme,
  readSiteTheme,
} from "./carsystem-map-style";
import styles from "./CarsystemMap.module.css";

type MapLibreMap = import("maplibre-gl").Map;

/**
 * Lightweight single-location Carsystem map: same MapLibre style family and
 * diamond marker language as the partner locator, but it only ever shows the
 * canonical company location. No partner data, no clustering, no search.
 * maplibre-gl is loaded lazily once the map scrolls near the viewport.
 */
export function CompanyLocationMap({
  className,
  showBadge = true,
  zoom = 12,
}: {
  className?: string;
  showBadge?: boolean;
  zoom?: number;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    let disposed = false;
    let disconnectTheme: (() => void) | null = null;
    let stopAttribution: (() => void) | null = null;

    async function init() {
      setStatus("loading");
      try {
        const [{ default: maplibregl }, style] = await Promise.all([
          import("maplibre-gl"),
          loadCarsystemMapStyle(readSiteTheme()),
        ]);
        if (disposed || !canvasRef.current) return;

        const center: [number, number] = [
          companyLocation.coordinates.lng,
          companyLocation.coordinates.lat,
        ];

        const map = new maplibregl.Map({
          container: canvasRef.current,
          style,
          center,
          zoom,
          interactive: false,
          attributionControl: { compact: true },
          // MapLibre daje platnu region „Map”; dve mape na početnoj moraju imati različita imena.
          locale: {
            "Map.Title": `Mapa: ${companyLocation.name}, ${companyLocation.city}`,
            ...MAP_ATTRIBUTION_LOCALE,
          },
        });
        mapRef.current = map;
        // Natpis izvora je vidljiv od kreiranja mape; pet sekundi se računa od tog trenutka.
        stopAttribution = collapseAttributionOnSmallMap(map);

        const element = document.createElement("span");
        element.className = `${styles.mapMarker} ${styles.mapMarkerCompany}`;
        element.setAttribute("aria-hidden", "true");
        new maplibregl.Marker({ element }).setLngLat(center).addTo(map);

        map.on("load", () => {
          if (!disposed) setStatus("ready");
        });

        disconnectTheme = observeSiteTheme(async (theme) => {
          const activeMap = mapRef.current;
          if (!activeMap) return;
          try {
            await swapCarsystemMapTheme(activeMap, theme);
          } catch (error) {
            console.error("CompanyLocationMap theme swap failed", error);
          }
        });
      } catch (error) {
        console.error("CompanyLocationMap init failed", error);
        if (!disposed) setStatus("error");
      }
    }

    const stopWaiting = startMapWhenNear(shell, () => void init());

    return () => {
      disposed = true;
      stopWaiting();
      disconnectTheme?.();
      stopAttribution?.();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [zoom]);

  return (
    <div
      aria-label={`Mapa: ${companyLocation.name}, ${companyLocation.city}`}
      className={`${styles.mapCanvasShell} ${className ?? ""}`}
      ref={shellRef}
      // „group”, ne „img”: mapa sadrži vezu i dugme za izvor podataka (OpenStreetMap),
      // a „img” ne sme imati interaktivne potomke (axe nested-interactive).
      role="group"
    >
      <div className={styles.mapCanvas} ref={canvasRef} />
      {status === "loading" || status === "idle" ? (
        <div className={styles.mapLoading} aria-hidden="true">
          <span />
        </div>
      ) : null}
      {status === "error" ? (
        <div className={styles.mapFallback}>
          <strong>{companyLocation.name}</strong>
          <span>{companyLocation.city}, Srbija</span>
        </div>
      ) : null}
      {showBadge && status !== "error" ? (
        <span className={styles.mapBadge} aria-hidden="true">
          {companyLocation.label}
        </span>
      ) : null}
    </div>
  );
}
