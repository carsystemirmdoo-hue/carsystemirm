import { redirect } from "next/navigation";

/**
 * Kreiranje porudžbine stiže u fazi 4, zajedno sa predlogom nabavke.
 * Do tada nema obrasca koji bi izgledao upotrebljivo a ne bi ništa sačuvao.
 */
export default function Page() {
  redirect("/portal/porudzbine");
}
