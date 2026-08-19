import { redirect } from "next/navigation";

/**
 * Ruta iz ranije verzije portala. Ekran nije deo dizajna „Poslovni sistem v2",
 * a prikazivao je demo podatke, pa vodi na odgovarajući aktuelni ekran.
 * Sam modul nije obrisan — vidi features/portal/.
 */
export default function Page() {
  redirect("/portal");
}
