import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  stores,
  tokenVotes,
  votes,
  tokenLocks,
} from "../../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[ScannerDB] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ── Stores ───────────────────────────────────────────────────────────────

export async function getStores() {
  const db = getDb();
  if (!db) return [];
  return db.select().from(stores);
}

export async function upsertStore(id: string, name: string, locale: string) {
  const db = getDb();
  if (!db) {
    console.warn("[ScannerDB] Cannot upsert store: database not available");
    return;
  }
  await db
    .insert(stores)
    .values({ id, name, locale })
    .onDuplicateKeyUpdate({ set: { name, locale } });
}

// ── Vote Tallies ─────────────────────────────────────────────────────────

export async function getVoteTallies(storeId: string, rawToken: string) {
  const db = getDb();
  if (!db) return [];
  return db
    .select()
    .from(tokenVotes)
    .where(and(eq(tokenVotes.storeId, storeId), eq(tokenVotes.rawToken, rawToken)))
    .orderBy(desc(tokenVotes.voteCount));
}

export async function incrementTally(
  storeId: string,
  rawToken: string,
  label: string
) {
  const db = getDb();
  if (!db) return;
  const existing = await db
    .select()
    .from(tokenVotes)
    .where(
      and(
        eq(tokenVotes.storeId, storeId),
        eq(tokenVotes.rawToken, rawToken),
        eq(tokenVotes.label, label)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(tokenVotes)
      .set({ voteCount: sql`vote_count + 1` })
      .where(eq(tokenVotes.id, existing[0].id));
  } else {
    await db.insert(tokenVotes).values({
      id: crypto.randomUUID(),
      storeId,
      rawToken,
      label,
      voteCount: 1,
    });
  }
}

export async function decrementTally(
  storeId: string,
  rawToken: string,
  label: string
) {
  const db = getDb();
  if (!db) return;
  await db
    .update(tokenVotes)
    .set({ voteCount: sql`GREATEST(vote_count - 1, 0)` })
    .where(
      and(
        eq(tokenVotes.storeId, storeId),
        eq(tokenVotes.rawToken, rawToken),
        eq(tokenVotes.label, label)
      )
    );
}

// ── User Votes ───────────────────────────────────────────────────────────

export async function getUserVote(
  userId: string,
  storeId: string,
  rawToken: string
) {
  const db = getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(votes)
    .where(
      and(
        eq(votes.userId, userId),
        eq(votes.storeId, storeId),
        eq(votes.rawToken, rawToken)
      )
    )
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function insertUserVote(
  userId: string,
  storeId: string,
  rawToken: string,
  label: string
) {
  const db = getDb();
  if (!db) return;
  await db.insert(votes).values({
    id: crypto.randomUUID(),
    userId,
    storeId,
    rawToken,
    label,
  });
}

export async function updateUserVote(
  userId: string,
  storeId: string,
  rawToken: string,
  newLabel: string
) {
  const db = getDb();
  if (!db) return;
  await db
    .update(votes)
    .set({ label: newLabel })
    .where(
      and(
        eq(votes.userId, userId),
        eq(votes.storeId, storeId),
        eq(votes.rawToken, rawToken)
      )
    );
}

// ── Locks ────────────────────────────────────────────────────────────────

export async function getLock(storeId: string, rawToken: string) {
  const db = getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(tokenLocks)
    .where(
      and(eq(tokenLocks.storeId, storeId), eq(tokenLocks.rawToken, rawToken))
    )
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertLock(
  storeId: string,
  rawToken: string,
  label: string,
  totalVotes: number
) {
  const db = getDb();
  if (!db) return;
  await db
    .insert(tokenLocks)
    .values({ storeId, rawToken, label, totalVotes })
    .onDuplicateKeyUpdate({
      set: { label, totalVotes, lockedAt: sql`NOW()` },
    });
}
