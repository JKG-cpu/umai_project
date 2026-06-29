import { describe, test, expect, vi } from "vitest";

vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "../_core/llm";
import { llmReceiptParse } from "./llm-receipt-parse";

function mockLLMResponse(content: string) {
  (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
    id: "test",
    created: Date.now(),
    model: "test",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      },
    ],
  });
}

function mockLLMError() {
  (invokeLLM as ReturnType<typeof vi.fn>).mockRejectedValue(
    new Error("API error")
  );
}

describe("llmReceiptParse", () => {
  test("parses valid JSON with food array", async () => {
    mockLLMResponse(JSON.stringify({ foods: ["milk", "bread", "yogurt"] }));
    const result = await llmReceiptParse("MILK 2.99\nBREAD 1.50", "us");
    expect(result).toEqual(["milk", "bread", "yogurt"]);
  });

  test("filters out non-string entries in foods array", async () => {
    mockLLMResponse(JSON.stringify({ foods: ["milk", null, 123, "bread"] }));
    const result = await llmReceiptParse("MILK\nBREAD", "us");
    expect(result).toEqual(["milk", "bread"]);
  });

  test("filters out empty strings", async () => {
    mockLLMResponse(JSON.stringify({ foods: ["milk", "", "bread"] }));
    const result = await llmReceiptParse("MILK\nBREAD", "us");
    expect(result).toEqual(["milk", "bread"]);
  });

  test("returns empty array when foods key is missing", async () => {
    mockLLMResponse(JSON.stringify({ items: ["milk"] }));
    const result = await llmReceiptParse("MILK", "us");
    expect(result).toEqual([]);
  });

  test("returns empty array when response is not valid JSON", async () => {
    mockLLMResponse("not json at all");
    const result = await llmReceiptParse("MILK", "us");
    expect(result).toEqual([]);
  });

  test("returns empty array on LLM failure", async () => {
    mockLLMError();
    const result = await llmReceiptParse("MILK", "us");
    expect(result).toEqual([]);
  });

  test("preserves locale in the user message", async () => {
    mockLLMResponse(JSON.stringify({ foods: ["latte", "pane"] }));
    await llmReceiptParse("LATTE\nPANE", "it");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("Locale: it"),
          }),
        ]),
      })
    );
  });

  test("sets responseFormat to json_object", async () => {
    mockLLMResponse(JSON.stringify({ foods: [] }));
    await llmReceiptParse("", "us");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        responseFormat: { type: "json_object" },
      })
    );
  });

  test("sets maxTokens to 1024", async () => {
    mockLLMResponse(JSON.stringify({ foods: [] }));
    await llmReceiptParse("", "us");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: 1024,
      })
    );
  });

  test("preserves duplicate products", async () => {
    mockLLMResponse(
      JSON.stringify({ foods: ["apple", "banana", "apple"] })
    );
    const result = await llmReceiptParse("APPLE\nBANANA\nAPPLE", "us");
    expect(result).toEqual(["apple", "banana", "apple"]);
  });

  test("handles empty ocr text gracefully", async () => {
    mockLLMResponse(JSON.stringify({ foods: [] }));
    const result = await llmReceiptParse("", "us");
    expect(result).toEqual([]);
  });

  test("sends system prompt as first message", async () => {
    mockLLMResponse(JSON.stringify({ foods: [] }));
    await llmReceiptParse("MILK", "us");
    expect(invokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining(
              "You are an AI specialized in understanding supermarket receipts"
            ),
          }),
          expect.any(Object),
        ],
      })
    );
  });
});
