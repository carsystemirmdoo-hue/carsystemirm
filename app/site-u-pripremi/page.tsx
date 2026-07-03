import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ComingSoonProgress } from "@/app/ComingSoonProgress";
import {
  getLocalSiteAccessPassword,
  getSiteAccessPasswordState,
} from "@/lib/site-access";

export const metadata: Metadata = {
  title: "Sajt u pripremi | Carsystem i R-M Inđija",
  description:
    "Carsystem i R-M Inđija javni sajt je u završnoj pripremi za katalog, lokator partnera i tehničku podršku.",
  robots: {
    follow: false,
    index: false,
  },
};

const features = [
  "Javni sajt",
  "Katalog programa",
  "Lokator partnera",
  "B2B priprema",
];

const mistParticles = [
  { delay: "0s", duration: "8s", size: "0.34rem", x: "24%", y: "22%" },
  { delay: "1.2s", duration: "9.5s", size: "0.24rem", x: "46%", y: "34%" },
  { delay: "2.4s", duration: "7.8s", size: "0.28rem", x: "68%", y: "20%" },
  { delay: "0.8s", duration: "10.2s", size: "0.2rem", x: "58%", y: "52%" },
  { delay: "3.1s", duration: "8.8s", size: "0.3rem", x: "34%", y: "62%" },
];

type SiteInPreparationPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function accessMessage(status: string, passwordState: ReturnType<typeof getSiteAccessPasswordState>) {
  if (passwordState === "missing") {
    return {
      tone: "danger",
      text: "Pristupna lozinka nije podešena. Dodajte SITE_ACCESS_PASSWORD na Vercel-u.",
    };
  }

  if (status === "invalid") {
    return { tone: "danger", text: "Kod nije ispravan. Proverite pristupnu lozinku." };
  }

  if (status === "missing") {
    return { tone: "danger", text: "Unesite pristupni kod za otključavanje sajta." };
  }

  if (status === "not-configured") {
    return {
      tone: "danger",
      text: "Pristup trenutno nije konfigurisan. Potrebna je SITE_ACCESS_PASSWORD env varijabla.",
    };
  }

  if (passwordState === "local-fallback") {
    return {
      tone: "muted",
      text: `Local/dev pristupni kod: ${getLocalSiteAccessPassword()}`,
    };
  }

  return { tone: "muted", text: "Unesite interni pristupni kod za pregled pravog sajta." };
}

export default async function SiteInPreparationPage({
  searchParams,
}: SiteInPreparationPageProps) {
  const params = (await searchParams) ?? {};
  const passwordState = getSiteAccessPasswordState();
  const message = accessMessage(firstParam(params.access), passwordState);
  const canUnlock = passwordState !== "missing";

  return (
    <main className="coming-soon" aria-labelledby="maintenance-title">
      <div className="scene" aria-hidden="true">
        <div className="technical-grid" />
        <div className="spotlight spotlight-primary" />
        <div className="spotlight spotlight-secondary" />
        <div className="spray-cone" />
        <div className="mist-field">
          {mistParticles.map((particle) => (
            <span
              className="mist-particle"
              key={`${particle.x}-${particle.y}`}
              style={
                {
                  "--particle-delay": particle.delay,
                  "--particle-duration": particle.duration,
                  "--particle-size": particle.size,
                  "--particle-x": particle.x,
                  "--particle-y": particle.y,
                } as CSSProperties
              }
            />
          ))}
        </div>
        <div className="orbital-mark">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="content-shell">
        <header className="brand-header reveal reveal-1">
          <span className="brand-mark" aria-label="Carsystem i R-M Inđija">
            <span className="brand-symbol" aria-hidden="true">
              <span />
            </span>
            <span className="brand-name">
              Carsystem <strong>i R-M</strong> Inđija
            </span>
          </span>

          <div className="brand-meta" aria-hidden="true">
            <span>Studio One showcase</span>
            <span className="brand-meta-index">Access locked</span>
          </div>
        </header>

        <section className="hero-copy">
          <p className="eyebrow reveal reveal-2">Sajt je u završnoj pripremi</p>
          <h1 id="maintenance-title" className="hero-title reveal reveal-3">
            Lakirnica dobija precizniji digitalni sistem.
          </h1>
          <p className="hero-subtitle reveal reveal-4">
            Pripremamo javni katalog, pregled programa, lokator partnerskih
            prodavnica i osnovu za budući B2B pristup.
          </p>
          <form
            action="/site-u-pripremi/access"
            className="access-panel reveal reveal-5"
            method="post"
          >
            <label className="access-label" htmlFor="site-access-code">
              Interni pristup
            </label>
            <div className="access-row">
              <input
                autoComplete="current-password"
                className="access-input"
                disabled={!canUnlock}
                id="site-access-code"
                name="accessCode"
                placeholder="Pristupni kod"
                type="password"
              />
              <button className="access-button" disabled={!canUnlock} type="submit">
                Otključaj sajt
              </button>
            </div>
            <p className="access-message" data-tone={message.tone}>
              {message.text}
            </p>
          </form>
          <ComingSoonProgress />
        </section>

        <section className="features-wrap reveal reveal-6" aria-label="Elementi u pripremi">
          <ul className="features-grid">
            {features.map((feature, index) => (
              <li
                className="feature-item"
                key={feature}
                style={{ "--feature-index": index } as CSSProperties}
              >
                <span className="feature-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="wave-wrap" aria-hidden="true">
        <svg className="paint-wave paint-wave-back" viewBox="0 0 1440 240" preserveAspectRatio="none">
          <path
            fill="oklch(0.46 0.16 26 / 0.65)"
            d="M0 154L80 146.7C160 139 320 125 480 130.7C640 136 800 162 960 164C1120 166 1280 144 1360 133.3L1440 122.7V240H0Z"
          />
        </svg>
        <svg className="paint-wave paint-wave-front" viewBox="0 0 1440 240" preserveAspectRatio="none">
          <path
            fill="oklch(0.58 0.235 26 / 0.78)"
            d="M0 166L90 152.7C180 139 360 112 540 122.7C720 133 900 181 1080 184C1260 187 1350 145 1440 124V240H0Z"
          />
        </svg>
      </div>
    </main>
  );
}
