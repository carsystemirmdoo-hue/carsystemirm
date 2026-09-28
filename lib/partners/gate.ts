/**
 * Uvoz registra partnera kroz portal.
 *
 * Podrazumevano ISKLJUČEN. Registar nosi adrese e-pošte i telefone iz izvora;
 * tokom pripreme oni ne ulaze u produkcionu bazu. Uključuje se tek odlukom
 * vlasnika, posle provere na test bazi (docs/b2b/23 §10).
 */
export const PARTNER_REGISTRY_FLAG = "FEATURE_PARTNER_REGISTRY";

export function isPartnerRegistryUploadEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[PARTNER_REGISTRY_FLAG] === "1";
}
