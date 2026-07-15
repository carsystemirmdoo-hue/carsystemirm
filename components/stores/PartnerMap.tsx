"use client";

import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type Marker,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/components/motion/usePrefersReducedMotion";
import {
  hasPartnerCoordinates,
  type PartnerStore,
} from "@/lib/partner-stores";
import {
  loadCarsystemMapStyle,
  observeSiteTheme,
  readSiteTheme,
} from "@/components/map/carsystem-map-style";
import mapStyles from "@/components/map/CarsystemMap.module.css";
import {
  getPartnerBounds,
  getPartnerMarkerCoordinateMap,
  toPartnerFeatureCollection,
} from "./partner-map-style";
import styles from "./StoresPage.module.css";

const SOURCE_ID = "partner-locations";
const PROBE_LAYER_ID = "partner-locations-probe";

// Approved search/filter camera: same fitBounds animation is reused for both
// the valid-result refit and the zero-result reset to Serbia coverage.
const REFIT_CAMERA = { duration: 500, padding: 56, maxZoom: 10 } as const;

// Selected partner framing: street/neighbourhood context around the exact
// address, using the same approved easeTo camera move.
const SELECTED_ZOOM = 14;

export function PartnerMap({
  badgeLabel = "Partnerska mreža · Srbija",
  className = styles.locatorCanvas,
  hoveredId,
  onError,
  onReady,
  onSelect,
  selectedId,
  stores,
  visibleIds,
}: {
  badgeLabel?: string;
  className?: string;
  hoveredId: string;
  onError: () => void;
  onReady: () => void;
  onSelect: (storeId: string) => void;
  selectedId: string;
  stores: PartnerStore[];
  visibleIds: Set<string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const clusterMarkersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const dimmedMarkersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const selectedIdRef = useRef(selectedId);
  const hoveredIdRef = useRef(hoveredId);
  const lastCameraTargetRef = useRef(selectedId);
  const lastVisibleCountRef = useRef<number | null>(null);
  const visibleIdsRef = useRef(visibleIds);
  const onSelectRef = useRef(onSelect);
  const prefersReducedMotion = usePrefersReducedMotion();
  const reducedMotionRef = useRef(prefersReducedMotion);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const storesWithCoords = useMemo(
    () => stores.filter(hasPartnerCoordinates),
    [stores],
  );
  const markerCoordinates = useMemo(
    () => getPartnerMarkerCoordinateMap(storesWithCoords),
    [storesWithCoords],
  );
  const visibleStores = useMemo(
    () => storesWithCoords.filter((store) => visibleIds.has(store.id)),
    [storesWithCoords, visibleIds],
  );

  selectedIdRef.current = selectedId;
  hoveredIdRef.current = hoveredId;
  visibleIdsRef.current = visibleIds;
  onSelectRef.current = onSelect;
  reducedMotionRef.current = prefersReducedMotion;

  /* ---------- init ---------- */

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let disposed = false;
    let map: MapLibreMap | null = null;
    let disconnectTheme: (() => void) | null = null;
    const storesById = new globalThis.Map(storesWithCoords.map((store) => [store.id, store]));

    function markerElement(store: PartnerStore) {
      const element = document.createElement("button");
      element.type = "button";
      element.className = mapStyles.mapMarker;
      element.setAttribute("aria-label", `Izaberi lokaciju ${store.name}, ${store.city}`);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        onSelectRef.current(store.id);
      });
      return element;
    }

    function syncMarkerState() {
      clusterMarkersRef.current.forEach((marker, key) => {
        if (!key.startsWith("store-")) return;
        const storeId = key.slice(6);
        const element = marker.getElement();
        element.classList.toggle(
          mapStyles.mapMarkerSelected,
          storeId === selectedIdRef.current,
        );
        element.classList.toggle(mapStyles.mapMarkerHover, storeId === hoveredIdRef.current);
      });
    }

    function updateClusterMarkers(activeMap: MapLibreMap) {
      const source = activeMap.getSource(SOURCE_ID);
      if (!source) return;

      const features = activeMap.querySourceFeatures(SOURCE_ID);
      const seen = new Set<string>();
      const markers = clusterMarkersRef.current;

      features.forEach((feature) => {
        if (feature.geometry.type !== "Point") return;
        const coordinates = feature.geometry.coordinates as [number, number];
        const props = feature.properties as Record<string, unknown>;
        const isCluster = Boolean(props.cluster);
        const key = isCluster ? `cluster-${props.cluster_id}` : `store-${props.id}`;

        if (seen.has(key)) return;
        seen.add(key);

        let marker = markers.get(key);
        if (!marker) {
          if (isCluster) {
            const element = document.createElement("button");
            element.type = "button";
            element.className = styles.mapCluster;
            element.textContent = String(props.point_count);
            element.setAttribute(
              "aria-label",
              `Grupa od ${props.point_count} lokacija, klikni za približavanje`,
            );
            const clusterId = props.cluster_id as number;
            element.addEventListener("click", async (event) => {
              event.stopPropagation();
              const geoSource = activeMap.getSource(SOURCE_ID) as GeoJSONSource;
              const zoom = await geoSource.getClusterExpansionZoom(clusterId);
              if (reducedMotionRef.current) {
                activeMap.jumpTo({ center: coordinates, zoom });
              } else {
                activeMap.easeTo({ center: coordinates, zoom, duration: 450 });
              }
            });
            marker = new maplibregl.Marker({ element }).setLngLat(coordinates);
          } else {
            const store = storesById.get(String(props.id));
            if (!store) return;
            marker = new maplibregl.Marker({ element: markerElement(store) }).setLngLat(
              coordinates,
            );
          }
          marker.addTo(activeMap);
          markers.set(key, marker);
        } else {
          marker.setLngLat(coordinates);
          if (isCluster) {
            marker.getElement().textContent = String(props.point_count);
          }
        }
      });

      markers.forEach((marker, key) => {
        if (seen.has(key)) return;
        marker.remove();
        markers.delete(key);
      });

      syncMarkerState();
    }

    function ensureSource(activeMap: MapLibreMap) {
      if (activeMap.getSource(SOURCE_ID)) return;

      activeMap.addSource(SOURCE_ID, {
        type: "geojson",
        data: toPartnerFeatureCollection(
          storesWithCoords.filter((store) => visibleIdsRef.current.has(store.id)),
          storesWithCoords,
        ),
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 42,
      });

      // Invisible probe layer keeps the GeoJSON source loaded so
      // querySourceFeatures returns clusters for the DOM markers.
      activeMap.addLayer({
        id: PROBE_LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: { "circle-radius": 0, "circle-opacity": 0 },
      });
    }

    async function init() {
      try {
        const style = await loadCarsystemMapStyle(readSiteTheme());
        if (disposed || !containerRef.current) return;

        const bounds = getPartnerBounds(storesWithCoords);

        map = new maplibregl.Map({
          container: containerRef.current,
          style,
          center: [20.6, 44.2],
          zoom: 6,
          attributionControl: { compact: true },
          cooperativeGestures: false,
        });
        mapRef.current = map;

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

        if (bounds) {
          map.fitBounds(bounds as LngLatBoundsLike, { animate: false, padding: 56, maxZoom: 9 });
        }

        map.on("load", () => {
          if (disposed || !map) return;
          ensureSource(map);
          updateClusterMarkers(map);
          setStatus("ready");
          onReady();
        });

        // After a theme-driven setStyle the sources are dropped; re-add them
        // once the new style is in place so the swap preserves all state.
        // "idle" backstops the styledata race when frames are throttled.
        map.on("styledata", () => {
          if (disposed || !map || !map.isStyleLoaded()) return;
          ensureSource(map);
        });

        map.on("idle", () => {
          if (disposed || !map || !map.isStyleLoaded()) return;
          ensureSource(map);
        });

        map.on("render", () => {
          if (disposed || !map || !map.getSource(SOURCE_ID)) return;
          updateClusterMarkers(map);
        });

        map.on("error", (event) => {
          // Tile-level errors are non-fatal; only fail hard when the map never
          // finished loading its style.
          if (!map || map.loaded()) return;
          console.error("PartnerMap error", event.error);
          setStatus((current) => {
            if (current !== "loading") return current;
            onError();
            return "error";
          });
        });

        disconnectTheme = observeSiteTheme(async (theme) => {
          const activeMap = mapRef.current;
          if (!activeMap) return;
          try {
            activeMap.setStyle(await loadCarsystemMapStyle(theme), { diff: false });
          } catch (error) {
            console.error("PartnerMap theme swap failed", error);
          }
        });
      } catch (error) {
        console.error("PartnerMap init failed", error);
        if (!disposed) {
          setStatus("error");
          onError();
        }
      }
    }

    init();

    const clusterMarkers = clusterMarkersRef.current;
    const dimmedMarkers = dimmedMarkersRef.current;

    return () => {
      disposed = true;
      disconnectTheme?.();
      clusterMarkers.forEach((marker) => marker.remove());
      clusterMarkers.clear();
      dimmedMarkers.forEach((marker) => marker.remove());
      dimmedMarkers.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- filtered set → source data + dimmed markers + camera ---------- */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;

    const source = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (source) {
      source.setData(toPartnerFeatureCollection(visibleStores, storesWithCoords));
    }

    // Stores excluded by search/filter stay in place at reduced opacity
    // instead of disappearing.
    const dimmed = dimmedMarkersRef.current;
    const nextDimmedIds = new Set(
      storesWithCoords
        .filter((store) => !visibleIds.has(store.id))
        .map((store) => store.id),
    );

    dimmed.forEach((marker, id) => {
      if (nextDimmedIds.has(id)) return;
      marker.remove();
      dimmed.delete(id);
    });

    nextDimmedIds.forEach((id) => {
      if (dimmed.has(id)) return;
      const store = storesWithCoords.find((item) => item.id === id);
      if (!store) return;
      const element = document.createElement("span");
      element.className = `${mapStyles.mapMarker} ${mapStyles.mapMarkerDimmed}`;
      element.setAttribute("aria-hidden", "true");
      const marker = new maplibregl.Marker({ element })
        .setLngLat(markerCoordinates.get(store.id) ?? [store.longitude, store.latitude])
        .addTo(map);
      dimmed.set(id, marker);
    });

    const previousVisibleCount = lastVisibleCountRef.current;
    lastVisibleCountRef.current = visibleStores.length;

    const bounds = getPartnerBounds(visibleStores);
    if (bounds) {
      map.fitBounds(bounds as LngLatBoundsLike, {
        animate: !prefersReducedMotion,
        ...REFIT_CAMERA,
      });
    } else if (visibleStores.length === 0 && previousVisibleCount !== 0) {
      // Zero-result state: breathe back out to the initial Serbia coverage
      // with the exact same approved refit animation. Only on the transition
      // into zero results — continued typing at zero must not restart it.
      const fullBounds = getPartnerBounds(storesWithCoords);
      if (fullBounds) {
        map.fitBounds(fullBounds as LngLatBoundsLike, {
          animate: !prefersReducedMotion,
          ...REFIT_CAMERA,
        });
      }
    }
  }, [
    markerCoordinates,
    prefersReducedMotion,
    status,
    storesWithCoords,
    visibleIds,
    visibleStores,
  ]);

  /* ---------- hover sync (visual emphasis only, never the camera) ---------- */

  useEffect(() => {
    if (status !== "ready") return;

    clusterMarkersRef.current.forEach((marker, key) => {
      if (!key.startsWith("store-")) return;
      marker
        .getElement()
        .classList.toggle(mapStyles.mapMarkerHover, key.slice(6) === hoveredId);
    });
  }, [hoveredId, status]);

  /* ---------- selection → marker state + camera ---------- */

  useEffect(() => {
    const map = mapRef.current;
    if (!map || status !== "ready") return;

    clusterMarkersRef.current.forEach((marker, key) => {
      if (!key.startsWith("store-")) return;
      marker
        .getElement()
        .classList.toggle(mapStyles.mapMarkerSelected, key.slice(6) === selectedId);
    });

    // Camera moves only on an explicit selection change, never on re-renders.
    if (selectedId === lastCameraTargetRef.current) return;
    lastCameraTargetRef.current = selectedId;

    const store = storesWithCoords.find((item) => item.id === selectedId);
    if (!store) return;

    const center = markerCoordinates.get(store.id) ?? [store.longitude, store.latitude];
    const zoom = Math.max(map.getZoom(), SELECTED_ZOOM);

    if (prefersReducedMotion) {
      map.jumpTo({ center, zoom });
    } else {
      map.easeTo({ center, zoom, duration: 500 });
    }
  }, [markerCoordinates, prefersReducedMotion, selectedId, status, storesWithCoords]);

  return (
    <div className={`${mapStyles.mapCanvasShell} ${className}`}>
      <div className={mapStyles.mapCanvas} ref={containerRef} role="presentation" />
      {status === "loading" ? (
        <div className={mapStyles.mapLoading} aria-hidden="true">
          <span />
        </div>
      ) : null}
      <span className={mapStyles.mapBadge} aria-hidden="true">
        {badgeLabel}
      </span>
    </div>
  );
}
