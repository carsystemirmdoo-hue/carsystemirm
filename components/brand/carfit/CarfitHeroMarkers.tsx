"use client";

import styles from "./CarfitBrandPage.module.css";

/**
 * Tehnički markeri na hero workbench-u. Klik skroluje do Task Selectora i bira
 * odgovarajući posao — bez hotspot gimmicka i bez hover zavisnosti na touchu.
 */
export function CarfitHeroMarkers({
  markers,
}: {
  markers: { id: string; label: string; taskId: string }[];
}) {
  function selectTask(taskId: string) {
    window.dispatchEvent(new CustomEvent("carfit:select-task", { detail: { taskId } }));

    const target = document.getElementById("poslovi");
    if (!target) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }

  return (
    <div className={styles.markerRow}>
      {markers.map((marker) => (
        <button
          className={styles.marker}
          key={marker.id}
          type="button"
          onClick={() => selectTask(marker.taskId)}
        >
          {marker.label}
        </button>
      ))}
    </div>
  );
}
