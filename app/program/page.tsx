import { redirect } from "next/navigation";

/** Nedovršen pregled programa je povučen; sačuvani linkovi vode u katalog. */
export default function ProgramIndexPage() {
  redirect("/katalog");
}
