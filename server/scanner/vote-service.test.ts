import { describe, test, expect, vi, beforeEach } from "vitest";

const mockData = vi.hoisted(() => {
  const locks: Record<string, any> = {};
  const tallies: Record<string, Array<{ label: string; voteCount: number }>> = {};
  const userVotes: Record<string, any> = {};
  return { locks, tallies, userVotes };
});

vi.mock("./db", () => ({
  getLock: vi.fn(async (storeId: string, rawToken: string) => {
    const key = `${storeId}:${rawToken}`;
    return mockData.locks[key] ?? null;
  }),
  getVoteTallies: vi.fn(async (storeId: string, rawToken: string) => {
    const key = `${storeId}:${rawToken}`;
    return mockData.tallies[key] ?? [];
  }),
  getUserVote: vi.fn(async (userId: string, storeId: string, rawToken: string) => {
    const key = `${userId}:${storeId}:${rawToken}`;
    return mockData.userVotes[key] ?? null;
  }),
  insertUserVote: vi.fn(async (_userId: string, _storeId: string, _rawToken: string, _label: string) => {
    const key = `${_userId}:${_storeId}:${_rawToken}`;
    mockData.userVotes[key] = { userId: _userId, storeId: _storeId, rawToken: _rawToken, label: _label };
  }),
  updateUserVote: vi.fn(async (_userId: string, _storeId: string, _rawToken: string, _label: string) => {
    const key = `${_userId}:${_storeId}:${_rawToken}`;
    if (mockData.userVotes[key]) mockData.userVotes[key].label = _label;
  }),
  incrementTally: vi.fn(async (_storeId: string, _rawToken: string, _label: string) => {
    const key = `${_storeId}:${_rawToken}`;
    if (!mockData.tallies[key]) mockData.tallies[key] = [];
    const existing = mockData.tallies[key].find((t) => t.label === _label);
    if (existing) {
      existing.voteCount++;
    } else {
      mockData.tallies[key].push({ label: _label, voteCount: 1 });
    }
  }),
  decrementTally: vi.fn(async (_storeId: string, _rawToken: string, _label: string) => {
    const key = `${_storeId}:${_rawToken}`;
    const existing = mockData.tallies[key]?.find((t) => t.label === _label);
    if (existing) existing.voteCount = Math.max(0, existing.voteCount - 1);
  }),
  upsertLock: vi.fn(async (_storeId: string, _rawToken: string, _label: string, totalVotes: number) => {
    const key = `${_storeId}:${_rawToken}`;
    mockData.locks[key] = { storeId: _storeId, rawToken: _rawToken, label: _label, totalVotes };
  }),
}));

vi.mock("./llm-guess", () => ({
  llmGuess: vi.fn(async (token: string) => {
    const map: Record<string, string> = {
      YOG: "yogurt",
      MOZZAR: "mozzarella",
      LATTE: "milk",
      PANE: "bread",
    };
    return map[token] ?? token.toLowerCase();
  }),
}));

import { resolveToken, recordVote } from "./vote-service";

beforeEach(() => {
  Object.keys(mockData.locks).forEach((k) => delete mockData.locks[k]);
  Object.keys(mockData.tallies).forEach((k) => delete mockData.tallies[k]);
  Object.keys(mockData.userVotes).forEach((k) => delete mockData.userVotes[k]);
});

describe("resolveToken", () => {
  test("returns locked token immediately", async () => {
    mockData.locks["lidl-it:YOG"] = { storeId: "lidl-it", rawToken: "YOG", label: "yogurt", totalVotes: 50 };
    const result = await resolveToken("YOG", "lidl-it");
    expect(result.label).toBe("yogurt");
    expect(result.locked).toBe(true);
    expect(result.confidence).toBeNull();
  });

  test("calls LLM when no votes exist", async () => {
    const result = await resolveToken("YOG", "lidl-it");
    expect(result.label).toBe("yogurt");
    expect(result.locked).toBe(false);
    expect(result.confidence).toBeNull();
  });

  test("returns top vote with confidence", async () => {
    mockData.tallies["lidl-it:MOZZAR"] = [
      { label: "mozzarella", voteCount: 2 },
      { label: "mozzarela", voteCount: 1 },
    ];
    const result = await resolveToken("MOZZAR", "lidl-it");
    expect(result.label).toBe("mozzarella");
    expect(result.locked).toBe(false);
    expect(result.confidence).toBeCloseTo(2 / 3);
  });

  test("locks token when threshold is met", async () => {
    mockData.tallies["lidl-it:YOG"] = [
      { label: "yogurt", voteCount: 30 },
      { label: "yougurt", voteCount: 1 },
    ];
    const result = await resolveToken("YOG", "lidl-it");
    expect(result.label).toBe("yogurt");
    expect(result.locked).toBe(true);
    expect(result.confidence).toBeNull();
    expect(mockData.locks["lidl-it:YOG"]).toBeDefined();
    expect(mockData.locks["lidl-it:YOG"].label).toBe("yogurt");
  });

  test("normalizes token to uppercase", async () => {
    mockData.tallies["lidl-it:YOG"] = [{ label: "yogurt", voteCount: 5 }];
    const result = await resolveToken(" yog ", "lidl-it");
    expect(result.label).toBe("yogurt");
  });

  test("returns empty for empty token", async () => {
    const result = await resolveToken("", "lidl-it");
    expect(result.label).toBe("");
    expect(result.locked).toBe(false);
    expect(result.confidence).toBeNull();
  });
});

describe("recordVote", () => {
  test("records a new vote and increments tally", async () => {
    await recordVote("user1", "lidl-it", "YOG", "yogurt");
    expect(mockData.userVotes["user1:lidl-it:YOG"]).toBeDefined();
    expect(mockData.userVotes["user1:lidl-it:YOG"].label).toBe("yogurt");
    expect(mockData.tallies["lidl-it:YOG"]).toHaveLength(1);
    expect(mockData.tallies["lidl-it:YOG"][0].voteCount).toBe(1);
  });

  test("no-op when voting same label again", async () => {
    mockData.userVotes["user1:lidl-it:YOG"] = { userId: "user1", storeId: "lidl-it", rawToken: "YOG", label: "yogurt" };
    mockData.tallies["lidl-it:YOG"] = [{ label: "yogurt", voteCount: 1 }];
    await recordVote("user1", "lidl-it", "YOG", "yogurt");
    expect(mockData.tallies["lidl-it:YOG"][0].voteCount).toBe(1);
  });

  test("multiple users vote on same token", async () => {
    await recordVote("user1", "lidl-it", "YOG", "yogurt");
    await recordVote("user2", "lidl-it", "YOG", "yogurt");
    await recordVote("user3", "lidl-it", "YOG", "yoghurt");
    const yogurtTally = mockData.tallies["lidl-it:YOG"].find((t) => t.label === "yogurt");
    const yoghurtTally = mockData.tallies["lidl-it:YOG"].find((t) => t.label === "yoghurt");
    expect(yogurtTally.voteCount).toBe(2);
    expect(yoghurtTally.voteCount).toBe(1);
  });

  test("normalizes token to uppercase and label to lowercase", async () => {
    await recordVote("user1", "lidl-it", " yog ", "Yogurt");
    expect(mockData.userVotes["user1:lidl-it:YOG"]).toBeDefined();
    expect(mockData.userVotes["user1:lidl-it:YOG"].label).toBe("yogurt");
  });

  test("handles empty token gracefully", async () => {
    await expect(recordVote("user1", "lidl-it", "", "yogurt")).resolves.toBeUndefined();
  });
});
