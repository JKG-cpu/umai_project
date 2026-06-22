import { describe, test, expect } from "vitest";
import { llmGuess } from "./llm-guess";

describe("llmGuess", () => {
  test("returns a lowercase string for a known token", async () => {
    const result = await llmGuess("YOG", "walmart-us");
    expect(typeof result).toBe("string");
    expect(result).toBe(result.toLowerCase());
  }, 30000);

  test("handles multi-word tokens", async () => {
    const result = await llmGuess("CHKN BRST", "walmart-us");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }, 30000);

  test("handles short tokens", async () => {
    const result = await llmGuess("BNN", "walmart-us");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }, 30000);

  test("handles Italian locale tokens", async () => {
    const result = await llmGuess("LATTE INTERO", "esselunga-it");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  }, 30000);

  test("falls back to raw token on empty/unknown token", async () => {
    const result = await llmGuess("ZZZZZZ", "unknown-store");
    expect(result).toBe("zzzzzz");
  }, 30000);

  test("fallback returns lowercase version of the raw token", async () => {
    const result = await llmGuess("MLEK", "unknown-store");
    expect(result).toBe("mlek");
  }, 30000);
});
