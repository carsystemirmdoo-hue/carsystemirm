/**
 * Okvir prijave, aktivacije i zaboravljene lozinke kupca: jedna mirna kartica.
 * Logotip je u zaglavlju naloga (AccountOnlyHeader / zaglavlje sajta); ovde se
 * ne ponavlja. Tokeni kupčevog dela, pa radi i u tamnoj temi.
 */
export function CustomerAuthShell({ eyebrow = "Pristup za kupce", title, lead, children, aside }: { eyebrow?: string; title: string; lead?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <main className="portal-root portal-customer-area pn-auth">
      <div className="pn pn-auth-card">
        <header style={{ display: "grid", gap: 4 }}>
          <span className="pn-small pn-muted" style={{ fontWeight: 600 }}>
            {eyebrow}
          </span>
          <h1 className="pn-title">{title}</h1>
          {lead ? <p className="pn-lead">{lead}</p> : null}
        </header>
        {children}
      </div>
      {aside ? <div className="pn pn-auth-aside">{aside}</div> : null}
    </main>
  );
}
