import base from "./Saveti.module.css";
import desktop from "./Saveti.desktop.module.css";
import mobile from "./Saveti.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase Saveti: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
