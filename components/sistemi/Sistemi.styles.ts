import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";
import base from "./Sistemi.module.css";
import desktop from "./Sistemi.desktop.module.css";
import mobile from "./Sistemi.mobile.module.css";

/** Jedina ulazna tačka za stilove stranica „Sistemi i programi“ (zajednički + desktop + mobilni). */
const styles = mergeResponsiveStyles(base, desktop, mobile);

export default styles;
