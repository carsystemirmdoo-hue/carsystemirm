"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

/**
 * No backend yet (static export, no API routes), so the form composes a
 * mailto: link client-side. BACKEND MIGRATION POINT: once an API route or
 * external form endpoint exists, replace handleSubmit's mailto logic with
 * a fetch() POST and keep the same form fields/markup.
 */
export function ContactForm() {
  const searchParams = useSearchParams();
  const prefillProduct = searchParams.get("proizvod") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    prefillProduct ? `Upit za proizvod: ${prefillProduct}\n\n` : ""
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = `Ime i prezime: ${name}\nEmail: ${email}\nTelefon: ${phone}\n\n${message}`;
    const mailto = `mailto:info@carsystem-rm.rs?subject=${encodeURIComponent(
      "Upit sa sajta — Carsystem RM"
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Ime i prezime" htmlFor="name">
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </Field>

      <Field label="Email" htmlFor="email">
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </Field>

      <Field label="Telefon" htmlFor="phone">
        <input
          id="phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </Field>

      <Field label="Poruka" htmlFor="message">
        <textarea
          id="message"
          required
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground"
        />
      </Field>

      <button
        type="submit"
        className="cs-magnetic-cta cs-theme-wipe-card mt-2 inline-flex w-fit items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground"
        data-cursor="button"
        data-motion-surface
        data-motion="theme-wipe"
      >
        <span>Pošaljite upit</span>
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}
