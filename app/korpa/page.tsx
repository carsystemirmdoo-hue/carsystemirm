import { redirect } from "next/navigation";

/**
 * Korpa je preseljena u klijentski portal. Javna adresa se zadržava samo kao
 * preusmerenje — dve paralelne korpe ne postoje.
 */
export default function Page() {
  redirect("/portal/korpa");
}
