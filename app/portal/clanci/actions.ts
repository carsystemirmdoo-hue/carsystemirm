"use server";

import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { can } from "@/lib/authz/permissions.mjs";
import { requireCapability, requireRecentMfaOrReauth } from "@/lib/authz/session";
import {
  MAX_SLIKA_ULAZ,
  napraviClanak,
  objaviOdmah,
  odobri,
  oznaciZaStrucnuPotvrdu,
  otkaziZakazivanje,
  otpremiSliku,
  posaljiNaPregled,
  povuci,
  sacuvajVerziju,
  SavetiError,
  vratiNaDoradu,
  vratiVerziju,
  zabeleziStrucnuPotvrdu,
  zakazi,
  type VerzijaUnos,
} from "@/lib/saveti/urednik/servis";

/*
 * Članci „Saveti i vodiči“ — serverske akcije. Svaka SAMA proverava sposobnost (skriveno dugme
 * nije ovlašćenje). Odobravanje, upis stručne potvrde, zakazivanje, objava i povlačenje menjaju
 * ono što vidi javnost, pa traže i SVEŽU potvrdu drugog faktora (isto pravilo kao potvrda
 * lagera); kada je istekla, vlasnik ide na ponovnu potvrdu identiteta i vraća se na članak.
 */
const LIST = "/portal/clanci";
const page = (id: string) => `${LIST}/${encodeURIComponent(id)}`;

export type ClanakActionState = { error: string | null; ok: string | null };
export type SlikaActionState = { error: string | null; slika: { id: string; sirina: number; visina: number } | null };

function sameActor<T extends Parameters<typeof can>[0] & { id: string }>(actor: { id: string }, fresh: T, capability: string): T {
  if (fresh.id !== actor.id || !can(fresh, capability)) forbidden();
  return fresh;
}

const poruka = (error: unknown) => (error instanceof SavetiError ? error.message : null);

/** Javne strane koje prikazuju članke ili veze ka njima (biblioteka, stranice programa, meni). */
function osveziJavno(slug?: string) {
  for (const path of ["/vodici", "/vodici/novosti", "/vodici/feed", "/sitemap.xml", "/vodici/stanje.json"]) revalidatePath(path);
  if (slug) revalidatePath(`/vodici/${slug}`);
  revalidatePath("/vodici/kategorije/[slug]", "page");
  revalidatePath("/program/[slug]", "page");
}

function unosIz(formData: FormData): VerzijaUnos {
  let parsed: Partial<VerzijaUnos> = {};
  try {
    parsed = JSON.parse(String(formData.get("sadrzaj") ?? "{}"));
  } catch {
    throw new SavetiError("unos", "Sadržaj forme nije čitljiv. Osvežite stranu i pokušajte ponovo.");
  }
  return {
    naslov: String(parsed.naslov ?? ""),
    metaNaslov: String(parsed.metaNaslov ?? ""),
    opis: String(parsed.opis ?? ""),
    telo: String(parsed.telo ?? ""),
    izvori: Array.isArray(parsed.izvori) ? parsed.izvori : [],
    interneNapomene: String(parsed.interneNapomene ?? ""),
    nepotvrdjeno: String(parsed.nepotvrdjeno ?? ""),
    slikaId: parsed.slikaId ? String(parsed.slikaId) : null,
    slikaAlt: String(parsed.slikaAlt ?? ""),
  };
}

async function uradi(fn: () => Promise<unknown>): Promise<ClanakActionState | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    const m = poruka(error);
    if (m) return { error: m, ok: null };
    throw error;
  }
}

export async function sacuvajAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = await requireCapability("articles:edit", LIST);
  const id = String(formData.get("id") ?? "");
  let unos: VerzijaUnos;
  try {
    unos = unosIz(formData);
  } catch (error) {
    return { error: poruka(error) ?? "Greška u formi.", ok: null };
  }
  if (!id) {
    let novi = "";
    const fail = await uradi(async () => {
      novi = (await napraviClanak(actor, { ...unos, tip: String(formData.get("tip") ?? ""), kategorija: String(formData.get("kategorija") ?? "") })).id;
    });
    if (fail) return fail;
    revalidatePath(LIST);
    redirect(`${page(novi)}?ishod=sacuvano`);
  }
  const osnova = Number(formData.get("osnova"));
  const novaAdresa = formData.get("promeniAdresu") === "da" ? String(formData.get("novaAdresa") ?? "").trim() : null;
  let rezultat: { broj: number; promenaSadrzaja: boolean } | null = null;
  const fail = await uradi(async () => {
    rezultat = await sacuvajVerziju(actor, id, { ...unos, osnova, novaAdresa });
  });
  if (fail) return fail;
  revalidatePath(LIST);
  revalidatePath(page(id));
  const r = rezultat as unknown as { broj: number; promenaSadrzaja: boolean };
  redirect(`${page(id)}?ishod=${r.promenaSadrzaja ? "sacuvano" : "sacuvano-napomene"}`);
}

export async function otpremiSlikuAction(_prev: SlikaActionState, formData: FormData): Promise<SlikaActionState> {
  const actor = await requireCapability("articles:edit", LIST);
  const file = formData.get("slika");
  if (!(file instanceof File) || file.size === 0) return { error: "Izaberite sliku.", slika: null };
  if (file.size > MAX_SLIKA_ULAZ) return { error: "Slika je veća od 8 MB.", slika: null };
  try {
    const slika = await otpremiSliku(actor, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
    return { error: null, slika };
  } catch (error) {
    const m = poruka(error);
    if (m) return { error: m, slika: null };
    console.error("[saveti] slika nije otpremljena", (error as Error)?.name);
    return { error: "Slika nije otpremljena. Pokušajte ponovo.", slika: null };
  }
}

export async function posaljiNaPregledAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = await requireCapability("articles:edit", LIST);
  const id = String(formData.get("id") ?? "");
  const fail = await uradi(() => posaljiNaPregled(actor, id));
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=na-pregledu`);
}

export async function vratiNaDoraduAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = await requireCapability("articles:approve", LIST);
  const id = String(formData.get("id") ?? "");
  const fail = await uradi(() => vratiNaDoradu(actor, id, String(formData.get("napomena") ?? "")));
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=dorada`);
}

export async function odobriAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = sameActor(await requireCapability("articles:approve", LIST), await requireRecentMfaOrReauth(page(String(formData.get("id") ?? ""))), "articles:approve");
  const id = String(formData.get("id") ?? "");
  if (formData.get("potvrda") !== "da") return { error: "Potvrdite da ste pročitali ovu verziju u pregledu.", ok: null };
  const fail = await uradi(() => odobri(actor, id, Number(formData.get("verzija"))));
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=odobreno`);
}

export async function zakaziAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = sameActor(await requireCapability("articles:publish", LIST), await requireRecentMfaOrReauth(page(String(formData.get("id") ?? ""))), "articles:publish");
  const id = String(formData.get("id") ?? "");
  const fail = await uradi(() => zakazi(actor, id, { datum: String(formData.get("datum") ?? ""), vreme: String(formData.get("vreme") ?? "") }));
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=zakazano`);
}

export async function otkaziAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = await requireCapability("articles:publish", LIST);
  const id = String(formData.get("id") ?? "");
  const fail = await uradi(() => otkaziZakazivanje(actor, id));
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=otkazano`);
}

export async function objaviOdmahAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = sameActor(await requireCapability("articles:publish", LIST), await requireRecentMfaOrReauth(page(String(formData.get("id") ?? ""))), "articles:publish");
  const id = String(formData.get("id") ?? "");
  let slug = "";
  const fail = await uradi(async () => {
    slug = (await objaviOdmah(actor, id, Number(formData.get("verzija")))).slug;
  });
  if (fail) return fail;
  osveziJavno(slug);
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=objavljeno`);
}

export async function strucnaPotvrdaAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = sameActor(await requireCapability("articles:approve", LIST), await requireRecentMfaOrReauth(page(String(formData.get("id") ?? ""))), "articles:approve");
  const id = String(formData.get("id") ?? "");
  if (formData.get("izjava") !== "da") return { error: "Potvrdite da potvrdu daje navedeni stručnjak, a ne urednička provera.", ok: null };
  const fail = await uradi(() =>
    zabeleziStrucnuPotvrdu(actor, id, {
      verzijaBroj: Number(formData.get("verzija")),
      strucnjak: String(formData.get("strucnjak") ?? ""),
      uloga: String(formData.get("uloga") ?? ""),
      datum: String(formData.get("datum") ?? ""),
      obuhvat: String(formData.get("obuhvat") ?? ""),
    }),
  );
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=strucna-potvrda`);
}

export async function oznaciStrucnuAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = await requireCapability("articles:edit", LIST);
  const id = String(formData.get("id") ?? "");
  const fail = await uradi(() => oznaciZaStrucnuPotvrdu(actor, id, String(formData.get("razlog") ?? "")));
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=oznaceno-strucna`);
}

export async function povuciAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = sameActor(await requireCapability("articles:publish", LIST), await requireRecentMfaOrReauth(page(String(formData.get("id") ?? ""))), "articles:publish");
  const id = String(formData.get("id") ?? "");
  let slug = "";
  const fail = await uradi(async () => {
    slug = (await povuci(actor, id, String(formData.get("razlog") ?? ""))).slug;
  });
  if (fail) return fail;
  osveziJavno(slug);
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=povuceno`);
}

export async function vratiVerzijuAction(_prev: ClanakActionState, formData: FormData): Promise<ClanakActionState> {
  const actor = await requireCapability("articles:edit", LIST);
  const id = String(formData.get("id") ?? "");
  const fail = await uradi(() => vratiVerziju(actor, id, Number(formData.get("broj")), Number(formData.get("osnova"))));
  if (fail) return fail;
  revalidatePath(LIST);
  redirect(`${page(id)}?ishod=vracena-verzija`);
}
