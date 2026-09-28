import type { DatasetInfo } from "@/lib/data-state/dataset";

/**
 * Tanka traka iznad sadržaja kada su podaci izmišljeni.
 *
 * U toku stranice, ne preko nje: ništa ne prekriva, a vidi se na svakom ekranu.
 * Za radnu bazu ne iscrtava ništa.
 */
export function DataStrip({ dataset }: { dataset: DatasetInfo }) {
  if (dataset.kind !== "demo") return null;
  return (
    <div className="portal-data-strip" role="note">
      <strong>DEMO PODACI</strong>
      <span>
        {dataset.label}. Firme, kupovine i nalozi su izmišljeni; brojke nisu poslovni podaci.
        {dataset.asOf ? ` Stanje na dan ${dataset.asOf}.` : ""}
      </span>
    </div>
  );
}
