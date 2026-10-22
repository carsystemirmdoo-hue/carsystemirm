import { savetiNacrtPregled } from "@/lib/saveti";
import styles from "./Saveti.styles";

/**
 * Oznaka lokalnog pregleda nacrta. Prikazuje se samo kada je uključen
 * `SAVETI_NACRT_PREGLED` van Vercela (vidi `savetiNacrtPregled`).
 */
export function SavetiNacrtTraka() {
  if (!savetiNacrtPregled()) return null;
  return (
    <div className={styles.nacrtTraka} role="note">
      <strong>Nacrt za pregled — nije objavljeno.</strong> Tekst je prošao tehničku i jezičku
      proveru, ali ga još nije odobrila imenovana osoba. Prikazuje se samo u lokalnom pregledu.
    </div>
  );
}
