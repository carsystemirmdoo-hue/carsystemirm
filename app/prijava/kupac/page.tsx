import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Stara adresa prijave kupca: zajednički ekran sa izabranom karticom „Kupac“.
 * Povratna adresa i poznata poruka se prenose; proveravaju se na `/prijava`.
 */
export default async function CustomerLoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; poruka?: string }> }) {
  const { callbackUrl, poruka } = await searchParams;
  const q = new URLSearchParams({ za: "kupac" });
  if (callbackUrl) q.set("callbackUrl", callbackUrl);
  if (poruka) q.set("poruka", poruka);
  redirect(`/prijava?${q.toString()}`);
}
