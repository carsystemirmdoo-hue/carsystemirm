import { refinishPhases, type RefinishPhaseSlug } from "@/lib/carsystem-data";
import styles from "./ProductDetailPage.module.css";

export function ProcessRail({
  activePhaseSlug,
}: {
  activePhaseSlug: RefinishPhaseSlug;
}) {
  return (
    <div className={styles.processRail} aria-label="Faze refinish procesa">
      <span className={styles.processRailLine} aria-hidden="true" />
      {refinishPhases.map((phase) => {
        const isActive = phase.slug === activePhaseSlug;

        return (
          <div
            className={`${styles.processRailItem} ${isActive ? styles.processRailItemActive : ""}`}
            aria-current={isActive ? "step" : undefined}
            key={phase.slug}
          >
            <span className={styles.processRailNode}>{String(phase.step).padStart(2, "0")}</span>
            <strong>{phase.name}</strong>
            <small>{phase.description}</small>
          </div>
        );
      })}
    </div>
  );
}
