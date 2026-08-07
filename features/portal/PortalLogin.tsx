"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/permissions/portal-permissions";
import type { UserRole } from "@/types/portal";
import { PortalIcon } from "@/components/portal/PortalIcon";
import { usePortal } from "@/components/portal/PortalProvider";

export function PortalLogin() {
  const router = useRouter();
  const { signIn } = usePortal();
  const [role, setRole] = useState<UserRole>("owner");
  const [identifier, setIdentifier] = useState("demo@carsystem.rs");
  const [password, setPassword] = useState("demo2026");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [quickRole, setQuickRole] = useState<UserRole | null>(null);
  const [error, setError] = useState("");
  const quickAccessLocked = useRef(false);

  function handleQuickAccess(nextRole: UserRole) {
    if (quickAccessLocked.current || loading) return;
    quickAccessLocked.current = true;
    setError("");
    setRole(nextRole);
    setQuickRole(nextRole);
    signIn(nextRole);
    window.setTimeout(() => router.push("/portal"), 420);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (loading || quickAccessLocked.current) return;
    setError("");
    if (!identifier.trim() || !password.trim()) {
      setError("Unesite korisničko ime i lozinku.");
      return;
    }
    setLoading(true);
    window.setTimeout(() => {
      if (password.toLocaleLowerCase("sr") === "pogresno") {
        setLoading(false);
        setError("Korisničko ime ili lozinka nisu ispravni. Za demo koristite lozinku demo2026.");
        return;
      }
      signIn(role);
      setLoading(false);
      router.push("/portal");
    }, 720);
  }

  return <main className="portal-login-root">
    <section className="portal-login-brand" aria-label="Carsystem i R-M poslovni portal">
      <div className="portal-login-brand-top"><span className="portal-company-symbol"><i/><i/><i/></span><span><strong>Carsystem i R-M DOO</strong><small>Inđija · Srbija</small></span></div>
      <div className="portal-login-brand-copy"><span>CS / RM · INTERNAL</span><h1>Poslovni tok, bez zastoja.</h1><p>Jedno mesto za porudžbine, kupce, cene i operativne integracije.</p></div>
      <div className="portal-login-signal"><div><span>Porudžbine</span><strong>25 aktivnih</strong><i><b style={{ width: "74%" }}/></i></div><div><span>Sinhronizacija</span><strong>Stabilna</strong><i><b style={{ width: "92%" }}/></i></div><div><span>Operativni red</span><strong>9 zahteva</strong><i><b style={{ width: "58%" }}/></i></div></div>
      <footer><span><i/>Mock okruženje</span><small>Frontend prototip · podaci se ne čuvaju</small></footer>
    </section>
    <section className="portal-login-form-side">
      <form className="portal-login-form" onSubmit={handleSubmit}>
        <div className="portal-login-mobile-mark"><span className="portal-company-symbol"><i/><i/><i/></span><strong>Carsystem i R-M DOO</strong></div>
        <header><span>Ovlašćeni pristup</span><h2>Interni poslovni portal</h2><p>Prijavite se ili izaberite ulogu za demonstraciju dozvola.</p></header>
        <section className="portal-quick-access" aria-labelledby="portal-quick-access-title">
          <div className="portal-quick-access-head"><span><strong id="portal-quick-access-title">Brzi pristup prototipu</strong><small>Bez unosa emaila ili lozinke</small></span><i>MOCK</i></div>
          <div className="portal-quick-access-actions">{(["owner", "sales", "office"] as UserRole[]).map((item) => <button type="button" key={item} disabled={Boolean(quickRole) || loading} data-loading={quickRole === item} onClick={() => handleQuickAccess(item)}><span>{item === "owner" ? "G" : item === "sales" ? "K" : "S"}</span><span><strong>{quickRole === item ? `Ulazak kao ${ROLE_LABELS[item]}…` : `Uđi kao ${ROLE_LABELS[item]}`}</strong><small>{ROLE_DESCRIPTIONS[item]}</small></span>{quickRole === item ? <i className="portal-button-spinner"/> : <PortalIcon name="arrow"/>}</button>)}</div>
          <p className="portal-quick-access-status" aria-live="polite">{quickRole ? `Prijava je uspešna. Otvaram dashboard za ulogu ${ROLE_LABELS[quickRole]}…` : "Izaberite ulogu i portal će se odmah otvoriti."}</p>
        </section>
        <div className="portal-login-divider"><span>ili klasična mock prijava</span></div>
        <fieldset className="portal-role-picker"><legend>Uloga za klasični obrazac</legend>{(["owner", "sales", "office"] as UserRole[]).map((item) => <button type="button" key={item} disabled={Boolean(quickRole) || loading} data-selected={role === item} onClick={() => setRole(item)}><span>{item === "owner" ? "G" : item === "sales" ? "K" : "S"}</span><strong>{ROLE_LABELS[item]}</strong><small>{ROLE_DESCRIPTIONS[item]}</small><i><PortalIcon name="check"/></i></button>)}</fieldset>
        <label className="portal-login-field"><span>Email ili korisničko ime</span><div><PortalIcon name="mail"/><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" aria-invalid={Boolean(error)} /></div></label>
        <label className="portal-login-field"><span>Lozinka</span><div><PortalIcon name="lock"/><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" aria-invalid={Boolean(error)} /></div></label>
        {error ? <div className="portal-login-error" role="alert"><PortalIcon name="warning"/><span><strong>Prijava nije uspela</strong><small>{error}</small></span></div> : null}
        <div className="portal-login-options"><label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)}/>Zapamti me</label><button type="button" onClick={() => setError("Link za resetovanje lozinke je mock u ovoj fazi.")}>Zaboravljena lozinka</button></div>
        <button className="portal-login-submit" type="submit" disabled={loading || Boolean(quickRole)}>{loading ? <span className="portal-button-spinner"/> : <PortalIcon name="arrow"/>}{loading ? "Provera pristupa…" : "Prijavi se"}</button>
        <p className="portal-login-note"><PortalIcon name="lock"/>Portal je namenjen isključivo ovlašćenim korisnicima Carsystem i R-M DOO.</p>
        <button type="button" className="portal-login-error-demo" onClick={() => { setPassword("pogresno"); setError(""); }}>Prikaži stanje pogrešne lozinke</button>
      </form>
    </section>
  </main>;
}
