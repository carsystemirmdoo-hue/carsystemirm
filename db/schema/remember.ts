import { index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { customerUsers } from "./customer-accounts";

/** „Zapamti me" za kupce (migracija 0031). U bazi je samo heš tokena. */
export const customerRememberTokens = pgTable(
  "customer_remember_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id").notNull().references(() => customerUsers.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    sessionVersion: integer("session_version").notNull(),
    deviceLabel: text("device_label").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedReason: text("revoked_reason"),
    replacedBy: uuid("replaced_by"),
    grantHash: text("grant_hash"),
    grantExpiresAt: timestamp("grant_expires_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("customer_remember_tokens_hash_key").on(table.tokenHash),
    uniqueIndex("customer_remember_tokens_grant_key").on(table.grantHash),
    index("customer_remember_tokens_account_idx").on(table.accountId, table.revokedAt),
    index("customer_remember_tokens_family_idx").on(table.familyId),
  ],
);
