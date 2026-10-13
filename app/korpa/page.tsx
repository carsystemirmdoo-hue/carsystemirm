import { redirect } from "next/navigation";

/**
 * Javna adresa korpe vodi u korpu NALOGA KUPCA (`/kupac/korpa`). Ranije je vodila u interni
 * portal zaposlenih (`/portal/korpa`), pa je neprijavljen kupac završavao na prijavi zaposlenih.
 * Neprijavljenog kupca `/kupac` šalje na prijavu kupca i vraća ga u korpu.
 */
export default function Page() {
  redirect("/kupac/korpa");
}
