import {
  getLock,
  getVoteTallies,
  getUserVote,
  insertUserVote,
  updateUserVote,
  incrementTally,
  decrementTally,
  upsertLock,
} from "./db";
import { llmGuess } from "./llm-guess";

const LOCK_CONFIDENCE = 0.9;
const LOCK_MIN_VOTES = 30;

export type ResolveResult = {
  label: string;
  locked: boolean;
  confidence: number | null;
};

export async function resolveToken(
  rawToken: string,
  storeId: string
): Promise<ResolveResult> {
  const token = rawToken.toUpperCase().trim();
  if (!token) return { label: "", locked: false, confidence: null };

  const lock = await getLock(storeId, token);
  if (lock) {
    return { label: lock.label, locked: true, confidence: null };
  }

  const tallies = await getVoteTallies(storeId, token);
  if (tallies.length === 0) {
    const guess = await llmGuess(token, storeId);
    return { label: guess, locked: false, confidence: null };
  }

  const total = tallies.reduce((sum, t) => sum + t.voteCount, 0);
  const top = tallies[0];
  const confidence = top.voteCount / total;

  if (confidence >= LOCK_CONFIDENCE && total >= LOCK_MIN_VOTES) {
    await upsertLock(storeId, token, top.label, total);
    return { label: top.label, locked: true, confidence: null };
  }

  return { label: top.label, locked: false, confidence };
}

export async function recordVote(
  userId: string,
  storeId: string,
  rawToken: string,
  label: string
): Promise<void> {
  const token = rawToken.toUpperCase().trim();
  const normalizedLabel = label.toLowerCase().trim();

  if (!token || !normalizedLabel) return;

  const existing = await getUserVote(userId, storeId, token);

  if (existing) {
    const oldLabel = existing.label;
    if (oldLabel === normalizedLabel) return;

    await decrementTally(storeId, token, oldLabel);
    await updateUserVote(userId, storeId, token, normalizedLabel);
  } else {
    await insertUserVote(userId, storeId, token, normalizedLabel);
  }

  await incrementTally(storeId, token, normalizedLabel);
}
