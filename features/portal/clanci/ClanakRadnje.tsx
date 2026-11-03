"use client";

import { useActionState, useState } from "react";
import { DateField } from "@/components/portal/DateField";
import {
  objaviOdmahAction,
  odobriAction,
  oznaciStrucnuAction,
  otkaziAction,
  posaljiNaPregledAction,
  povuciAction,
  vratiNaDoraduAction,
  strucnaPotvrdaAction,
  vratiVerzijuAction,
  zakaziAction,
  type ClanakActionState,
} from "@/app/portal/clanci/actions";

const INITIAL: ClanakActionState = { error: null, ok: null };

function Greska({ state }: { state: ClanakActionState }) {
  return state.error ? (
    <p className="portal-login-error cl-action-error" role="alert">
      {state.error}
    </p>
  ) : null;
}

export function PosaljiNaPregled({ id }: { id: string }) {
  const [state, action, pending] = useActionState(posaljiNaPregledAction, INITIAL);
  return (
    <form action={action} className="cl-action">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
        {pending ? "Slanje…" : "Pošaljite na pregled"}
      </button>
      <Greska state={state} />
    </form>
  );
}

export function Odobri({ id, verzija, izmene }: { id: string; verzija: number; izmene: boolean }) {
  const [state, action, pending] = useActionState(odobriAction, INITIAL);
  return (
    <form action={action} className="cl-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="verzija" value={verzija} />
      <label className="cl-check">
        <input type="checkbox" name="potvrda" value="da" required />
        <span>Pročitao/la sam verziju {verzija} u pregledu{izmene ? " (izmene objavljenog članka)" : ""} i odobravam je.</span>
      </label>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
        {pending ? "Odobravanje…" : `Odobrite verziju ${verzija}`}
      </button>
      <Greska state={state} />
    </form>
  );
}

export function VratiNaDoradu({ id }: { id: string }) {
  const [state, action, pending] = useActionState(vratiNaDoraduAction, INITIAL);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="portal-button" data-variant="ghost" onClick={() => setOpen(true)}>
        Vratite na doradu
      </button>
    );
  return (
    <form action={action} className="cl-action">
      <input type="hidden" name="id" value={id} />
      <label className="portal-field">
        <span>Šta treba doraditi</span>
        <textarea name="napomena" rows={3} maxLength={1000} />
      </label>
      <button type="submit" className="portal-button" data-variant="secondary" disabled={pending}>
        Vratite na doradu
      </button>
      <Greska state={state} />
    </form>
  );
}

/** Vreme objave u koracima od 15 minuta (vreme Srbije). */
const VREMENA = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`);

export function Zakazi({ id, danas }: { id: string; danas: string }) {
  const [state, action, pending] = useActionState(zakaziAction, INITIAL);
  return (
    <form action={action} className="cl-action cl-schedule">
      <input type="hidden" name="id" value={id} />
      <DateField name="datum" label="Datum objave" defaultValue={danas} required />
      <label className="portal-field">
        <span>Vreme (vreme Srbije)</span>
        <select name="vreme" defaultValue="09:00">
          {VREMENA.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
        {pending ? "Zakazivanje…" : "Zakažite objavu"}
      </button>
      <Greska state={state} />
    </form>
  );
}

export function OtkaziTermin({ id }: { id: string }) {
  const [state, action, pending] = useActionState(otkaziAction, INITIAL);
  return (
    <form action={action} className="cl-action">
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="portal-button" data-variant="secondary" disabled={pending}>
        Otkažite termin
      </button>
      <Greska state={state} />
    </form>
  );
}

export function ObjaviOdmah({ id, verzija, izmene }: { id: string; verzija: number; izmene: boolean }) {
  const [state, action, pending] = useActionState(objaviOdmahAction, INITIAL);
  return (
    <form action={action} className="cl-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="verzija" value={verzija} />
      <button type="submit" className="portal-button" data-variant={izmene ? "primary" : "secondary"} disabled={pending}>
        {pending ? "Objavljivanje…" : izmene ? "Objavite izmene odmah" : "Objavite odmah"}
      </button>
      <Greska state={state} />
    </form>
  );
}

/**
 * Upis stručne potvrde za verziju koju je stručnjak pregledao. Odvojeno od odobrenja vlasnika:
 * forma traži ime i stručnost stručnjaka i izričitu izjavu da potvrda nije urednička provera.
 */
export function StrucnaPotvrda({ id, verzija, danas }: { id: string; verzija: number; danas: string }) {
  const [state, action, pending] = useActionState(strucnaPotvrdaAction, INITIAL);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="portal-button" data-variant="secondary" onClick={() => setOpen(true)}>
        Upišite stručnu potvrdu
      </button>
    );
  return (
    <form action={action} className="cl-action cl-expert">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="verzija" value={verzija} />
      <label className="portal-field">
        <span>Ime i prezime stručnjaka</span>
        <input name="strucnjak" maxLength={160} required autoComplete="off" />
      </label>
      <label className="portal-field">
        <span>Stručnost ili funkcija</span>
        <input name="uloga" maxLength={160} required autoComplete="off" placeholder="npr. tehnolog boja, lice za bezbednost i zdravlje na radu" />
      </label>
      <DateField name="datum" label="Datum potvrde" defaultValue={danas} required />
      <label className="portal-field">
        <span>Šta je potvrđeno</span>
        <textarea name="obuhvat" rows={3} maxLength={1000} required />
      </label>
      <label className="cl-check">
        <input type="checkbox" name="izjava" value="da" required />
        <span>Potvrdu za verziju {verzija} daje navedeni stručnjak. Ovo nije urednička provera ni odobrenje vlasnika.</span>
      </label>
      <button type="submit" className="portal-button" data-variant="primary" disabled={pending}>
        {pending ? "Upis…" : `Upišite potvrdu za verziju ${verzija}`}
      </button>
      <Greska state={state} />
    </form>
  );
}

export function OznaciStrucnu({ id }: { id: string }) {
  const [state, action, pending] = useActionState(oznaciStrucnuAction, INITIAL);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="portal-button" data-variant="ghost" onClick={() => setOpen(true)}>
        Tekst traži stručnu potvrdu
      </button>
    );
  return (
    <form action={action} className="cl-action">
      <input type="hidden" name="id" value={id} />
      <label className="portal-field">
        <span>Šta stručnjak treba da potvrdi</span>
        <textarea name="razlog" rows={3} maxLength={2000} required />
      </label>
      <p className="cl-sub">Oznaka se ne može ukloniti. Tekst se može odobriti tek posle upisane stručne potvrde.</p>
      <button type="submit" className="portal-button" data-variant="secondary" disabled={pending}>
        Označite
      </button>
      <Greska state={state} />
    </form>
  );
}

export function Povuci({ id }: { id: string }) {
  const [state, action, pending] = useActionState(povuciAction, INITIAL);
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button type="button" className="portal-button" data-variant="danger" onClick={() => setOpen(true)}>
        Povucite iz javnog prikaza
      </button>
    );
  return (
    <form action={action} className="cl-action">
      <input type="hidden" name="id" value={id} />
      <label className="portal-field">
        <span>Razlog povlačenja (interno)</span>
        <textarea name="razlog" rows={2} maxLength={500} required />
      </label>
      <button type="submit" className="portal-button" data-variant="danger" disabled={pending}>
        {pending ? "Povlačenje…" : "Potvrdite povlačenje"}
      </button>
      <Greska state={state} />
    </form>
  );
}

export function VratiVerziju({ id, broj, osnova }: { id: string; broj: number; osnova: number }) {
  const [state, action, pending] = useActionState(vratiVerzijuAction, INITIAL);
  return (
    <form action={action} className="cl-inline-action">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="broj" value={broj} />
      <input type="hidden" name="osnova" value={osnova} />
      <button type="submit" className="portal-button" data-size="sm" disabled={pending} title={`Napravite novu verziju sa sadržajem verzije ${broj}`}>
        Vratite ovu verziju
      </button>
      <Greska state={state} />
    </form>
  );
}

/**
 * Pregled u stvarnom izgledu sajta: računar ili telefon. Otvara se u zasebnom prozoru, jer sajt
 * namerno zabranjuje prikaz u okviru (`frame-ancestors 'none'`, lib/security/http-headers.mjs) i
 * ta zaštita se zbog pregleda ne slabi. Prozor „telefon“ je širok 390 px.
 */
export function PregledOkvir({ src }: { src: string }) {
  return (
    <div className="cl-preview-bar">
      <a className="portal-button" data-variant="primary" href={src} target="_blank" rel="noopener">
        Otvorite pregled (računar)
      </a>
      <a
        className="portal-button"
        href={src}
        target="pregled-telefon"
        rel="noopener"
        onClick={(e) => {
          const w = window.open(src, "pregled-telefon", "popup,width=390,height=844");
          if (w) e.preventDefault();
        }}
      >
        Pregled u širini telefona (390 px)
      </a>
    </div>
  );
}
