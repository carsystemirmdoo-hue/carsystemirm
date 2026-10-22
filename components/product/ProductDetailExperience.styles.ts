import base from "./ProductDetailExperience.module.css";
import desktop from "./ProductDetailExperience.desktop.module.css";
import mobile from "./ProductDetailExperience.mobile.module.css";
import { mergeResponsiveStyles } from "@/lib/ui/mergeResponsiveStyles";

/** Klase ProductDetailExperience: zajednički izgled + desktop + mobilni raspored pod istim imenom. */
const styles = mergeResponsiveStyles(base, desktop, mobile);
export default styles;
