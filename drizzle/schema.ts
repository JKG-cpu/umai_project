import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Receipt Item Voting Tables ─────────────────────────────────────────

export const stores = mysqlTable("stores", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  locale: varchar("locale", { length: 8 }).notNull(),
});

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

export const tokenVotes = mysqlTable("token_votes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  storeId: varchar("store_id", { length: 64 }).notNull(),
  rawToken: varchar("raw_token", { length: 128 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  voteCount: int("vote_count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type TokenVote = typeof tokenVotes.$inferSelect;
export type InsertTokenVote = typeof tokenVotes.$inferInsert;

export const votes = mysqlTable("votes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  storeId: varchar("store_id", { length: 64 }).notNull(),
  rawToken: varchar("raw_token", { length: 128 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Vote = typeof votes.$inferSelect;
export type InsertVote = typeof votes.$inferInsert;

export const tokenLocks = mysqlTable("token_locks", {
  storeId: varchar("store_id", { length: 64 }).notNull(),
  rawToken: varchar("raw_token", { length: 128 }).notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  lockedAt: timestamp("locked_at").defaultNow().notNull(),
  totalVotes: int("total_votes").notNull(),
});

export type TokenLock = typeof tokenLocks.$inferSelect;
export type InsertTokenLock = typeof tokenLocks.$inferInsert;