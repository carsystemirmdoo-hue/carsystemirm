import type { Metadata } from "next";
import { PortalFrame } from "@/components/portal/PortalShell";
import { PortalProvider } from "@/components/portal/PortalProvider";
import "./portal.css";

export const metadata: Metadata = {
  title: "Interni poslovni portal",
  description: "Interni frontend prototip poslovnog portala Carsystem i R-M DOO.",
  robots: { index: false, follow: false, noarchive: true },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalProvider><PortalFrame>{children}</PortalFrame></PortalProvider>;
}
